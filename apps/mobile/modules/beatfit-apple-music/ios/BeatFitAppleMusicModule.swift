import ExpoModulesCore
import Foundation
import MusicKit

public final class BeatFitAppleMusicModule: Module {
  private static let apiOrigin = URL(string: "https://api.music.apple.com")!
  private let connectedKey = "beatfit.appleMusic.connected"

  public func definition() -> ModuleDefinition {
    Name("BeatFitAppleMusic")

    AsyncFunction("authorizationStatus") { () -> String in
      guard UserDefaults.standard.bool(forKey: self.connectedKey) else { return "not_determined" }
      return self.statusName(MusicAuthorization.currentStatus)
    }

    AsyncFunction("authorize") { (_ developerToken: String?) async -> String in
      let status = await MusicAuthorization.request()
      guard status == .authorized else { return self.statusName(status) }
      let subscription = try await MusicSubscription.current
      guard subscription.canPlayCatalogContent else { return "no_subscription" }
      UserDefaults.standard.set(true, forKey: self.connectedKey)
      return "authorized"
    }

    AsyncFunction("disconnect") { () -> Void in
      // Apple owns the system permission; disconnect removes BeatFit's logical connection.
      UserDefaults.standard.removeObject(forKey: self.connectedKey)
    }

    AsyncFunction("listPlaylists") { (_ page: String?) async throws -> [String: Any] in
      let url = try self.appleMusicURL(
        page ?? "/v1/me/library/playlists?limit=25"
      )
      return try await self.requestPage(url: url, kind: "playlist")
    }

    AsyncFunction("getPlaylistTracks") {
      (_ id: String, _ page: String?) async throws -> [String: Any] in
      var allowedPathCharacters = CharacterSet.urlPathAllowed
      allowedPathCharacters.remove(charactersIn: "/?#")
      guard
        let encoded = id.addingPercentEncoding(withAllowedCharacters: allowedPathCharacters),
        !encoded.isEmpty
      else {
        throw Exception(
          name: "APPLE_MUSIC_INVALID_REQUEST",
          description: "Apple Music playlist identifier is invalid."
        )
      }
      let url = try self.appleMusicURL(
        page ?? "/v1/me/library/playlists/\(encoded)/tracks?limit=25"
      )
      return try await self.requestPage(url: url, kind: "track")
    }
  }

  private func appleMusicURL(_ value: String) throws -> URL {
    guard
      let url = URL(string: value, relativeTo: Self.apiOrigin)?.absoluteURL,
      url.scheme == "https",
      url.host?.lowercased() == "api.music.apple.com",
      url.user == nil,
      url.password == nil
    else {
      throw Exception(
        name: "APPLE_MUSIC_INVALID_REQUEST",
        description: "Apple Music pagination URL is invalid."
      )
    }
    return url
  }

  private func statusName(_ status: MusicAuthorization.Status) -> String {
    switch status {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "not_determined"
    @unknown default: return "unavailable"
    }
  }

  private func requestPage(url: URL, kind: String) async throws -> [String: Any] {
    let response = try await MusicDataRequest(urlRequest: URLRequest(url: url)).response()
    guard let json = try JSONSerialization.jsonObject(with: response.data) as? [String: Any],
      let data = json["data"] as? [[String: Any]]
    else {
      throw Exception(
        name: "APPLE_MUSIC_INVALID_RESPONSE", description: "Apple Music returned invalid metadata.")
    }
    let storefront = kind == "track" ? try await self.currentStorefront() : "us"
    let items = data.map {
      kind == "playlist" ? self.playlist($0) : self.track($0, storefront: storefront)
    }
    var result: [String: Any] = ["items": items]
    if let next = json["next"] as? String { result["next"] = next }
    return result
  }

  private func playlist(_ resource: [String: Any]) -> [String: Any] {
    let attributes = resource["attributes"] as? [String: Any] ?? [:]
    var result: [String: Any] = [
      "id": resource["id"] as? String ?? "",
      "name": attributes["name"] as? String ?? "Untitled playlist",
      "artworkUrl": artworkURL(attributes["artwork"]),
    ]
    if let count = attributes["trackCount"] as? Int { result["trackCount"] = count }
    return result
  }

  private func track(_ resource: [String: Any], storefront: String) -> [String: Any] {
    let attributes = resource["attributes"] as? [String: Any] ?? [:]
    let id = resource["id"] as? String ?? ""
    let playParams = attributes["playParams"] as? [String: Any]
    let catalogId = playParams?["catalogId"] as? String ?? playParams?["id"] as? String ?? id
    var result: [String: Any] = [
      "id": id,
      "title": attributes["name"] as? String ?? "Unknown title",
      "artist": attributes["artistName"] as? String ?? "Unknown artist",
      "artwork_url": artworkURL(attributes["artwork"]),
      "isPlayable": playParams != nil,
      "provider_identifier": [
        "provider": "apple_music", "catalog_id": catalogId,
        "library_id": id, "storefront": storefront,
      ],
    ]
    if let duration = attributes["durationInMillis"] as? Int { result["duration_ms"] = duration }
    return result
  }

  private func currentStorefront() async throws -> String {
    let url = try self.appleMusicURL("/v1/me/storefront")
    let response = try await MusicDataRequest(urlRequest: URLRequest(url: url)).response()
    guard let json = try JSONSerialization.jsonObject(with: response.data) as? [String: Any],
      let data = json["data"] as? [[String: Any]], let id = data.first?["id"] as? String
    else {
      return "us"
    }
    return id
  }

  private func artworkURL(_ value: Any?) -> Any {
    guard
      let artwork = value as? [String: Any],
      var url = artwork["url"] as? String
    else {
      return NSNull()
    }
    url =
      url
      .replacingOccurrences(of: "{w}", with: "600")
      .replacingOccurrences(of: "{h}", with: "600")
    return url
  }
}

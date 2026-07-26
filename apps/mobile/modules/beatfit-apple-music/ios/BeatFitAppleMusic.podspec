Pod::Spec.new do |s|
  s.name           = 'BeatFitAppleMusic'
  s.version        = '1.0.0'
  s.summary        = 'BeatFit MusicKit metadata bridge'
  s.description    = 'Apple Music authorization and library metadata for BeatFit.'
  s.author         = 'BeatFit'
  s.homepage       = 'https://github.com/WonChung/beatfit'
  s.platforms      = { :ios => '16.0' }
  s.source         = { :git => 'https://github.com/WonChung/beatfit.git', :branch => 'main' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'MusicKit'
  s.swift_version = '5.9'
  s.source_files = '**/*.{h,m,mm,swift}'
end

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const moduleRoot = resolve(mobileRoot, 'modules/beatfit-apple-music');
const autolinkingPackage = require.resolve('expo-modules-autolinking/package.json');
const autolinkingCli = resolve(dirname(autolinkingPackage), 'bin/expo-modules-autolinking.js');

function resolveModules(platform) {
  const output = execFileSync(
    process.execPath,
    [autolinkingCli, 'resolve', '--platform', platform, '--json'],
    {
      cwd: mobileRoot,
      encoding: 'utf8',
    }
  );

  return JSON.parse(output).modules;
}

const appleModule = resolveModules('apple').find(
  ({ packageName }) => packageName === 'beatfit-apple-music'
);

if (!appleModule) {
  throw new Error('BeatFitAppleMusic was not discovered by Expo autolinking for Apple platforms.');
}

const expectedPodspecDirectory = resolve(moduleRoot, 'ios');
const nativePod = appleModule.pods?.find(({ podName }) => podName === 'BeatFitAppleMusic');
if (!nativePod || resolve(nativePod.podspecDir) !== expectedPodspecDirectory) {
  throw new Error('BeatFitAppleMusic did not resolve to its checked-in iOS podspec directory.');
}

if (!appleModule.modules?.some(({ class: moduleClass }) => moduleClass === 'BeatFitAppleMusicModule')) {
  throw new Error('BeatFitAppleMusicModule was not registered for Apple platforms.');
}

const androidModule = resolveModules('android').find(
  ({ packageName }) => packageName === 'beatfit-apple-music'
);
if (androidModule) {
  throw new Error(
    'BeatFitAppleMusic unexpectedly advertises Android support before its native bridge is implemented.'
  );
}

console.log('Verified BeatFitAppleMusic Apple autolinking and Android exclusion.');

// Plugin de configuração do Expo (CNG) — assinatura release do PULSO.
//
// O PULSO usa Continuous Native Generation: android/ é gerado por
// `expo prebuild` e NÃO fica no repositório. Este plugin injeta no
// android/app/build.gradle recém-gerado a linha que aplica a assinatura
// release versionada em signing/ (keystore + senhas) — o mesmo efeito de
// anexar o script à mão, mas reproduzível em qualquer máquina/CI.
//
// Caminho resolvido com rootProject.file (raiz = android/), então
// ../scripts/ aponta para o scripts/ DO REPOSITÓRIO.

const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const APPLY_LINE =
  '\n// PULSO: assinatura release do repositório (signing/)\n' +
  'apply from: rootProject.file("../scripts/android-signing.gradle")\n';

module.exports = function withPulsoSigning(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const gradlePath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'build.gradle'
      );
      let src = fs.readFileSync(gradlePath, 'utf8');
      if (!src.includes('android-signing.gradle')) {
        src += APPLY_LINE;
        fs.writeFileSync(gradlePath, src);
      }
      return cfg;
    },
  ]);
};

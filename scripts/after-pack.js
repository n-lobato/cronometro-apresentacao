// Assinatura ad hoc no macOS. Sem ela, o app não abre em Macs com chip Apple
// (M1, M2, M3...). Não substitui a assinatura de desenvolvedor da Apple:
// na primeira abertura o macOS ainda pede confirmação (veja o README).
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};

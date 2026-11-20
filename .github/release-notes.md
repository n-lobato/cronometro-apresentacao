Cronômetro que fica no canto da tela, por cima da apresentação em tela cheia.

**Qual arquivo baixar**

* Windows: `...-windows-instalador.exe` (instala) ou `...-windows-portatil.exe` (roda sem instalar)
* macOS com chip Apple (M1 a M4): `...-macos-arm64.dmg`
* macOS Intel: `...-macos-x64.dmg`
* Linux: `...-linux-x86_64.AppImage` ou `...-linux-amd64.deb`

Na primeira abertura o Windows e o macOS mostram um aviso de segurança, porque o programa não tem assinatura digital paga. Veja no [README](https://github.com/n-lobato/cronometro-apresentacao#primeira-abertura) como liberar.

**Novidades da v1.1.1**

* Correção: se o limite do laranja for maior que o do amarelo, os valores são trocados automaticamente, e a fase amarela não some mais
* Correção: os botões de +1 minuto (painel, janelinha, bandeja e atalho) respeitam o limite de 600 minutos
* Builds reproduzíveis: versões das dependências travadas em lockfile

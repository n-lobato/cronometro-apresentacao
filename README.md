# Cronômetro de apresentação

Protótipo em desenvolvimento. Os arquivos recebidos estão preservados em original/; a versão revisada está em web/.

## Web
Abra web/index.html mantendo app.js e timer.js na mesma pasta. Não exige instalação nem rede. Aplicar preserva o tempo transcorrido; Reiniciar zera e deixa pausado, pedindo confirmação quando há tempo decorrido. A hora usa o fuso local. A janela flutuante depende de Document Picture-in-Picture; teste o suporte no navegador e a sobreposição com seus slides.

## Desktop: protótipo Windows, Linux e macOS
Requer Node.js/npm e ambiente gráfico. Na raiz:

    npm install --save-dev --save-exact electron
    npm test
    npm start

O comando de instalação escolhe a versão disponível naquele momento; revisar e preservar o package-lock.json gerado antes de distribuir. Electron não foi instalado nem executado aqui. Não há instaladores ou assinatura. Menu Cronômetro: Modo compacto e Sempre no topo. Compatibilidade de janela, tela cheia, múltiplos monitores e Linux/Wayland ainda precisa ser verificada. Fechar ou recarregar perde a contagem.

## Testes e limitações
Executado: node tests/timer.test.cjs, com 12 testes de lógica aprovados; verificação sintática dos arquivos JavaScript e do ponto de entrada desktop. Não são testes de navegador, interface, PiP, Electron, sistema operacional ou suspensão.

A contagem ainda usa Date.now(): recupera o intervalo sem atualização se o relógio não mudar, mas ajustes no relógio do sistema podem alterar a duração medida. A proteção contra saltos do relógio NÃO foi implementada. A regra desejada é contar a suspensão, salvo pausa explícita; validação real e implementação robusta por sistema são pendentes. Não usar sem ensaio em apresentação crítica.

A versão PowerShell em original/ permanece sem as correções propostas. A interface revisada evita piscar e usa texto de estado além de cor. O alerta laranja no último minuto independe do limiar amarelo.

A interface desktop tem Node desabilitado, isolamento de contexto, sandbox, bloqueio de navegação e novas janelas; isso não equivale a auditoria de segurança. Não expõe APIs privilegiadas ao JavaScript da página.

## Próximas etapas
- Testar a interface e a janela flutuante em navegador real.
- Implementar e validar a medição de duração com suspensão e alterações do relógio.
- Validar desktop nos três sistemas, incluindo tela cheia e monitores.
- Reforçar validação e diagnóstico da alternativa PowerShell.
- Gerar lockfile revisado, empacotar e avaliar assinatura/notarização.
- Escolher licença com o autor. Nenhuma licença de distribuição foi escolhida.

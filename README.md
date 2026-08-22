# Central de Mapas Analíticos — COA

Aplicação local React + TypeScript para cadastrar, organizar, importar e copiar mapas analíticos e suas legendas.

## Executar

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite (normalmente `http://localhost:5173`).

## Persistência

Dados e imagens ficam no IndexedDB do navegador, banco `coa-mapas-analiticos`. Use **Cadastros → Exportar backup** regularmente. Nenhuma credencial da Solinftec é armazenada.

## Escopo atual

Fase 1: cadastros, mapas, templates, legendas, importação de imagem, copiar/baixar, favoritos, busca, filtros, histórico de capturas e backup.

## Legenda por print

A tela **Legenda por print** aceita uma imagem principal e uma imagem complementar. O OCR roda no navegador, tenta reconhecer tipo, setor, operação, período, equipamentos e médias, e gera uma legenda editável. A primeira análise pode baixar os dados de idioma português do mecanismo OCR. As imagens e resultados salvos continuam armazenados apenas no IndexedDB local.

Turnos, rotinas, extensão do navegador e recorte pertencem às próximas fases.

## Deploy no Render

O projeto inclui `render.yaml` para deploy como Static Site.

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- SPA rewrite: `/*` para `/index.html`

No Render, escolha **New → Blueprint**, conecte este repositório e confirme a criação do serviço.

> Os mapas e imagens são armazenados no IndexedDB de cada navegador. O deploy não sincroniza dados entre computadores ou navegadores.

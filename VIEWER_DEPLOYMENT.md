# LAC Map ���� Viewer

��� �����: https://github.com/defpine/LAC_Map
���� Pages �ּ�: https://defpine.github.io/LAC_Map/

## ���� �и�

- ���� ��: `npm run dev` / `npm run build` �� `src/main.tsx`, `dist/`
- ���� Viewer: `npm run build:viewer` �� `src/viewer/main.tsx`, `dist-viewer/index.html`
- Viewer �̸�����: `npm run preview:viewer` �� http://localhost:4173/LAC_Map/
- Viewer ����: `npm run prepare:viewer`, `npm run dev:viewer` �� /LAC_Map/viewer.html
- ����: `npm run check:viewer`

Viewer�� Editor ȭ��, File System Access ����/���� ���, Geoman ���̺귯���� �������� �ʽ��ϴ�. ���� ��� �˻�� �� ��踦 �����մϴ�. ���� �������� �����̰� ���� ȭ�鿡���� ������ Ȱ��ȭ���� �ʽ��ϴ�. ���� ���� Pages�� ���ε����� ������.

## �����Ϳ� ����

������ FiveM_LAC/Data/*.json �� FiveM_LAC/Assets/�Դϴ�. Viewer ���� �غ� �ܰ�� ������ JSON 8��(project + ����/����/���� + �ǹ�/��Ŀ/���/����/NPC/�ü� ����)�� �����մϴ�. ���� ����� scripts/prepare-viewer.mjs�� �����ϼ���. Backup, settings �� �ҽ��� �������� �ʽ��ϴ�.

- Data/: ���� JSON
- Assets/images/maps/: ���� ������ �̸�����
- Assets/images/maps/tiles/: Ÿ�� (level_0~5, 512px PNG)
- Assets/images/icons/: �����ܿ� ���� ��� ����
- assets/: ����� ����˸�ü

���� ������ ����� ����/�̸�����/Ÿ�ϸ� �����մϴ�. �ڵ� ���� public-viewer/�� dist-viewer/�� Ŀ������ �ʽ��ϴ�. ������ ������ ���� Editor���� ���� �� FiveM_LAC/Data �� ������ Assets�� ����� main�� Ŀ��/Ǫ���մϴ�. �� ������ ������ ���ϸ��� �����ص� ���ŵ� JSON�� �����մϴ�. JSON���� ������ ���븸 ��������.

## ���� ����

1. �� ������Ʈ �ҽ�, package-lock.json, .env.viewer, .github/workflows/pages.yml, FiveM_LAC/Data �� �ʿ��� Assets, public/assets/fonts�� ����� ��Ʈ�� �����մϴ�.
2. ����� Settings �� Pages �� Build and deployment �� Source���� GitHub Actions�� �����մϴ�.
3. main�� Ǫ���ϰų� Actions���� Deploy public Viewer to GitHub Pages�� ���� �����մϴ�.
4. Actions�� github-pages ���� URL�� �̵��� ���� �̵�/��, ����, �˻� ���, ��, ����� ȭ���� Ȯ���մϴ�.

Actions�� Node 22 + npm ci�� Viewer�� ����/�����ϰ� dist-viewer�� ���ε��մϴ�. Pages�� base_path�� Vite base�� �����ϹǷ� ����� ���� ��ο� �½��ϴ�. ���� �⺻���� .env.viewer�� /LAC_Map/�Դϴ�. Ŀ���� ������ ���� �� PAGES_BASE_PATH=/�� �����ϼ���. ��� ��� ����ʹ� ������� �ʽ��ϴ�.

## ���� ������ ���� Ȯ��

���� TypeScript �˻�� �� production ����, Viewer ����/Ÿ�� ���� �˻�, Editor ��� ���� �˻�� �����մϴ�. ���� ȯ���� ��Ʈ��ũ �������� localhost ������ ���Ӱ� GitHub ���� ������ �Ұ����ϸ� ���� UI ����/���ε�/Pages ������ �Ϸ�� ������ �������� �ʽ��ϴ�.

���� �� ����: ������ ��Ʈ��ũ �ǿ��� JSON 8��, ���� Ÿ�ϰ� �۲� ���� Ȯ��; �̸�/ID/������ȣ �˻� �� ��� ����; �Ϲ� Ŭ�� �� ���� ����; ��� ���Ϳ� �׷� ���; Ȯ�� �� ������ȣ; �ְ� ���ֺ� ��� ���Ա�; �ǹ�/��Ŀ ���� ��; ����� �гΰ� �� ��ũ��.

## Large map source

The original map_000001.png is stored as ordered .part-000 through .part-009 files because of the connected upload request limit. npm run prepare:viewer restores the exact PNG automatically and checks its size and SHA-256 before preparing the Viewer. Keep all parts and the .sha256 manifest together. Locally edited full PNG files take precedence when already present.


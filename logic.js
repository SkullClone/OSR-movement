const ID = "com.osr-movement.pro";
const METADATA_KEY = `${ID}/config`;
const TOKEN_DATA_KEY = `${ID}/data`;

let appState = {
    turn: 1, mode: 'global', globalLimit: 120, gmIgnored: true, totalLock: false
};
let gridCache = { dpi: 300, scale: 5, unit: 'ft' };
let currentUserRole = "PLAYER";

OBR.onReady(async () => {
    currentUserRole = await OBR.player.getRole();
    await updateGridCache();
    await loadSceneMetadata();

    document.getElementById('next-turn-btn').onclick = nextTurn;
    document.getElementById('global-limit').onchange = (e) => { 
        appState.globalLimit = parseFloat(e.target.value); 
        OBR.scene.setMetadata({ [METADATA_KEY]: appState }); 
    };
    document.getElementById('gm-ignored').onchange = (e) => { 
        appState.gmIgnored = e.target.checked; 
        OBR.scene.setMetadata({ [METADATA_KEY]: appState }); 
    };
    document.getElementById('total-lock').onchange = (e) => { 
        appState.totalLock = e.target.checked; 
        OBR.scene.setMetadata({ [METADATA_KEY]: appState }); 
        updateUI();
    };

    OBR.player.onChange((player) => { currentUserRole = player.role; });
    OBR.scene.grid.onChange(updateGridCache);

    OBR.scene.items.onChange(async (items) => {
        if (currentUserRole === "GM" && appState.gmIgnored) return;
        const tokens = items.filter(i => i.layer === "CHARACTER");
        const updates = [];
        for (const token of tokens) {
            const data = token.metadata[TOKEN_DATA_KEY];
            if (!data || !data.startPos) continue;
            if (appState.totalLock) {
                updates.push({ id: token.id, position: data.startPos });
                continue;
            }
            const dist = (Math.sqrt(Math.pow(token.position.x - data.startPos.x, 2) + Math.pow(token.position.y - data.startPos.y, 2)) / gridCache.dpi) * gridCache.scale;
            if (dist > appState.globalLimit + 0.1) {
                updates.push({ id: token.id, position: data.lastValidPos || data.startPos });
            } else {
                OBR.scene.items.updateItems([token.id], (items) => {
                    items[0].metadata[TOKEN_DATA_KEY].lastValidPos = token.position;
                });
            }
        }
        if (updates.length > 0) OBR.scene.items.updateItems(updates.map(u => u.id), (items) => {
            items.forEach(item => { const u = updates.find(x => x.id === item.id); if(u) item.position = u.position; });
        });
    });
});

async function updateGridCache() {
    const grid = await OBR.scene.grid.getScale();
    const dpi = await OBR.scene.grid.getDpi();
    gridCache = { dpi: dpi || 300, scale: grid.parsed?.multiplier ?? 5, unit: grid.parsed?.unit ?? "ft" };
}

async function nextTurn() {
    appState.turn++;
    await OBR.scene.setMetadata({ [METADATA_KEY]: appState });
    const items = await OBR.scene.items.getItems(i => i.layer === "CHARACTER");
    await OBR.scene.items.updateItems(items.map(i => i.id), (items) => {
        items.forEach(item => { item.metadata[TOKEN_DATA_KEY] = { startPos: item.position, lastValidPos: item.position }; });
    });
    updateUI();
}

async function loadSceneMetadata() {
    const meta = await OBR.scene.getMetadata();
    if (meta[METADATA_KEY]) appState = { ...appState, ...meta[METADATA_KEY] };
    updateUI();
}

function updateUI() {
    document.getElementById('turn-count').innerText = appState.turn;
    document.getElementById('global-limit').value = appState.globalLimit;
    document.getElementById('gm-ignored').checked = appState.gmIgnored;
    document.getElementById('total-lock').checked = appState.totalLock;
}

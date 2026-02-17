const ID = "com.osr-movement.pro";
const METADATA_KEY = `${ID}/config`;
const TOKEN_DATA_KEY = `${ID}/data`;

let appState = {
    turn: 1, encounterFreq: 2, mode: 'global', globalLimit: 120, gmIgnored: true, totalLock: false
};
let gridCache = { dpi: 300, scale: 5, unit: 'ft' };
let currentUserRole = "PLAYER";

OBR.onReady(async () => {
    try {
        currentUserRole = await OBR.player.getRole();
        await updateGridCache();
        await loadSceneMetadata();
    } catch (e) { console.error(e); }

    setupUIListeners();

    OBR.player.onChange((player) => { currentUserRole = player.role; handleSelection(player.selection); });
    OBR.scene.grid.onChange(updateGridCache);

    OBR.scene.items.onChange(async (items) => {
        if (currentUserRole === "GM" && appState.gmIgnored) return;
        const movedTokens = items.filter(i => i.layer === "CHARACTER" || i.layer === "MOUNT");
        if (movedTokens.length === 0) return;
        const updates = [];
        const metadataUpdates = [];
        for (const token of movedTokens) {
            const data = token.metadata[TOKEN_DATA_KEY];
            if (!data || !data.startPos) continue;
            if (appState.totalLock) {
                if (calculatePixelDistance(token.position, data.startPos) > 1) {
                    updates.push({ id: token.id, position: data.startPos });
                }
                continue;
            }
            const dist = calculateDistance(data.startPos, token.position);
            let limit = appState.globalLimit;
            if (appState.mode === 'individual' && data.individualLimit != null) limit = data.individualLimit;
            if (dist > limit + 0.1) {
                const safePos = data.lastValidPos || data.startPos;
                if (token.position.x !== safePos.x || token.position.y !== safePos.y) {
                    updates.push({ id: token.id, position: safePos });
                }
            } else {
                const lastSaved = data.lastValidPos || data.startPos;
                if (calculateDistance(lastSaved, token.position) > 0.5) {
                    metadataUpdates.push({
                        id: token.id, metadata: { ...token.metadata, [TOKEN_DATA_KEY]: { ...data, lastValidPos: token.position } }
                    });
                }
            }
        }
        if (updates.length > 0) await OBR.scene.items.updateItems(updates.map(u => u.id), (items) => {
            items.forEach(item => { const u = updates.find(x => x.id === item.id); if(u) item.position = u.position; });
        });
        if (metadataUpdates.length > 0) await OBR.scene.items.updateItems(metadataUpdates.map(u => u.id), (items) => {
            for(const item of items) { const u = metadataUpdates.find(x => x.id === item.id); if(u) item.metadata = u.metadata; }
        });
    });
});

async function updateGridCache() {
    try {
        const grid = await OBR.scene.grid.getScale();
        const dpi = await OBR.scene.grid.getDpi();
        gridCache = { dpi: dpi || 300, scale: grid.parsed?.multiplier ?? parseInt(grid.parsed) ?? 5, unit: grid.parsed?.unit ?? "ft" };
        const label = document.getElementById('unit-label');
        if(label) label.innerText = gridCache.unit;
    } catch (e) { gridCache = { dpi: 300, scale: 5, unit: 'ft' }; }
}

function calculatePixelDistance(p1, p2) { return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)); }
function calculateDistance(p1, p2) { return (calculatePixelDistance(p1, p2) / gridCache.dpi) * gridCache.scale; }

async function nextTurn() {
    appState.turn++;
    await OBR.scene.setMetadata({ [METADATA_KEY]: appState });
    OBR.notification.show(`Turno ${appState.turn}`);
    const items = await OBR.scene.items.getItems(i => i.layer === "CHARACTER" || i.layer === "MOUNT");
    if (items.length > 0) await OBR.scene.items.updateItems(items.map(i => i.id), (items) => {
        for (const item of items) {
            const currentData = item.metadata[TOKEN_DATA_KEY] || {};
            item.metadata[TOKEN_DATA_KEY] = { individualLimit: currentData.individualLimit, startPos: item.position, lastValidPos: item.position };
        }
    });
}

async function loadSceneMetadata() {
    const meta = await OBR.scene.getMetadata();
    if (meta[METADATA_KEY]) appState = { ...appState, ...meta[METADATA_KEY] };
    updateUI();
}

function setupUIListeners() {
    document.getElementById('next-turn-btn').onclick = nextTurn;
    document.getElementById('global-limit').onchange = (e) => { appState.globalLimit = parseFloat(e.target.value); OBR.scene.setMetadata({ [METADATA_KEY]: appState }); };
    document.getElementById('gm-ignored').onchange = (e) => { appState.gmIgnored = e.target.checked; OBR.scene.setMetadata({ [METADATA_KEY]: appState }); };
    document.getElementById('total-lock').onchange = (e) => { appState.totalLock = e.target.checked; OBR.scene.setMetadata({ [METADATA_KEY]: appState }); updateUI(); };
    document.querySelectorAll('input[name="mode"]').forEach(el => el.onchange = (e) => { appState.mode = e.target.value; OBR.scene.setMetadata({ [METADATA_KEY]: appState }); updateUI(); });
}

function updateUI() {
    document.getElementById('turn-count').innerText = appState.turn;
    document.getElementById('global-limit').value = appState.globalLimit;
    document.getElementById('gm-ignored').checked = appState.gmIgnored;
    document.getElementById('total-lock').checked = appState.totalLock;
    document.getElementById('global-settings').style.display = appState.mode === 'global' ? 'block' : 'none';
    document.getElementById('individual-settings').style.display = appState.mode === 'individual' ? 'block' : 'none';
}

async function handleSelection(sel) {
    const editor = document.getElementById('token-editor');
    if (!sel || sel.length !== 1) { editor.style.display = 'none'; return; }
    const item = (await OBR.scene.items.getItems([sel[0]]))[0];
    if (item && (item.layer === "CHARACTER" || item.layer === "MOUNT")) {
        editor.style.display = 'block';
        document.getElementById('token-name').innerText = item.name || "Token";
    }
        }

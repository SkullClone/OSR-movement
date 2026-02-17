const ID = "com.osr-movement.beta";
const METADATA_KEY = `${ID}/config`;
const TOKEN_DATA_KEY = `${ID}/data`;

let appState = {
    turn: 1, 
    encounterFreq: 2, 
    globalLimit: 120, 
    gmIgnored: true, 
    totalLock: false,
    torches: 0,
    torchTurnsLeft: 0,
    torchDuration: 6
};

let gridCache = { dpi: 300, scale: 5, unit: 'ft' };
let currentUserRole = "PLAYER";

OBR.onReady(async () => {
    currentUserRole = await OBR.player.getRole();
    await updateGridCache();
    await loadSceneMetadata();

    // Listeners de UI
    document.getElementById('next-turn-btn').onclick = nextTurn;
    document.getElementById('global-limit').onchange = (e) => { appState.globalLimit = parseFloat(e.target.value); saveState(); };
    document.getElementById('encounter-freq').onchange = (e) => { appState.encounterFreq = parseInt(e.target.value); saveState(); };
    document.getElementById('torch-count').onchange = (e) => { 
        appState.torches = parseInt(e.target.value); 
        if(appState.torches > 0 && appState.torchTurnsLeft <= 0) appState.torchTurnsLeft = appState.torchDuration;
        saveState(); updateUI(); 
    };
    document.getElementById('torch-duration').onchange = (e) => { appState.torchDuration = parseInt(e.target.value); saveState(); };
    document.getElementById('gm-ignored').onchange = (e) => { appState.gmIgnored = e.target.checked; saveState(); };
    document.getElementById('total-lock').onchange = (e) => { appState.totalLock = e.target.checked; saveState(); updateUI(); };

    OBR.scene.grid.onChange(updateGridCache);

    // Vigilante de Movimiento
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
                if (distPx(token.position, data.startPos) > 1) {
                    updates.push({ id: token.id, position: data.startPos });
                }
                continue;
            }

            const actualDist = (distPx(data.startPos, token.position) / gridCache.dpi) * gridCache.scale;

            if (actualDist > appState.globalLimit + 0.1) {
                const safePos = data.lastValidPos || data.startPos;
                if (token.position.x !== safePos.x || token.position.y !== safePos.y) {
                    updates.push({ id: token.id, position: safePos });
                }
            } else {
                const lastSaved = data.lastValidPos || data.startPos;
                const change = (distPx(lastSaved, token.position) / gridCache.dpi) * gridCache.scale;
                if (change > 0.5) { // Anti-spam: solo guardar cada 0.5 unidades
                    metadataUpdates.push({
                        id: token.id,
                        metadata: { ...token.metadata, [TOKEN_DATA_KEY]: { ...data, lastValidPos: token.position } }
                    });
                }
            }
        }

        if (updates.length > 0) {
            await OBR.scene.items.updateItems(updates.map(u => u.id), (items) => {
                items.forEach(item => { const u = updates.find(x => x.id === item.id); if(u) item.position = u.position; });
            });
            OBR.notification.show("🚫 Movimiento máximo alcanzado");
        } else if (metadataUpdates.length > 0) {
            await OBR.scene.items.updateItems(metadataUpdates.map(u => u.id), (items) => {
                for(const item of items) {
                    const u = metadataUpdates.find(x => x.id === item.id);
                    if(u) item.metadata = u.metadata;
                }
            });
        }
    });
});

function distPx(p1, p2) { return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)); }

async function updateGridCache() {
    const grid = await OBR.scene.grid.getScale();
    const dpi = await OBR.scene.grid.getDpi();
    gridCache = { dpi: dpi || 300, scale: grid.parsed?.multiplier ?? 5, unit: grid.parsed?.unit ?? "ft" };
    const label = document.getElementById('unit-label');
    if(label) label.innerText = gridCache.unit;
}

async function nextTurn() {
    appState.turn++;
    
    // Lógica de Antorchas
    if (appState.torches > 0) {
        appState.torchTurnsLeft--;
        if (appState.torchTurnsLeft <= 0) {
            appState.torches--;
            if (appState.torches > 0) {
                appState.torchTurnsLeft = appState.torchDuration;
                OBR.notification.show("🔥 Una antorcha se ha agotado. Enciendes otra.", "INFO");
            } else {
                OBR.notification.show("🌑 ¡La última antorcha se ha apagado! Estás a oscuras.", "ERROR");
            }
        }
    }

    if (appState.turn % appState.encounterFreq === 0) OBR.notification.show("🎲 ¡Chequeo de Encuentro Errante!", "WARNING");

    saveState();

    const items = await OBR.scene.items.getItems(i => i.layer === "CHARACTER" || i.layer === "MOUNT");
    await OBR.scene.items.updateItems(items.map(i => i.id), (items) => {
        items.forEach(item => {
            item.metadata[TOKEN_DATA_KEY] = { startPos: item.position, lastValidPos: item.position };
        });
    });
    updateUI();
}

async function loadSceneMetadata() {
    const meta = await OBR.scene.getMetadata();
    if (meta[METADATA_KEY]) appState = { ...appState, ...meta[METADATA_KEY] };
    updateUI();
}

async function saveState() { await OBR.scene.setMetadata({ [METADATA_KEY]: appState }); }

function updateUI() {
    document.getElementById('turn-count').innerText = appState.turn;
    document.getElementById('encounter-freq').value = appState.encounterFreq;
    document.getElementById('torch-count').value = appState.torches;
    document.getElementById('torch-duration').value = appState.torchDuration;
    document.getElementById('global-limit').value = appState.globalLimit;
    document.getElementById('gm-ignored').checked = appState.gmIgnored;
    document.getElementById('total-lock').checked = appState.totalLock;

    const status = document.getElementById('torch-status');
    if (appState.torches > 0) {
        status.innerText = `🔥 Luz para ${appState.torchTurnsLeft} turnos más`;
    } else {
        status.innerText = "🌑 Sin antorchas activas";
    }
                                      }

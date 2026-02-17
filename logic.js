const M_ID = "com.skullclone.osr_move";

OBR.onReady(async () => {
    let state = { turn: 1, lightOn: false, torch: 6, limit: 120, freq: 2, restrictGM: false };

    // Cargar metadatos de la escena para persistencia
    const load = async () => {
        const meta = await OBR.scene.getMetadata();
        if (meta[M_ID]) state = { ...state, ...meta[M_ID] };
        document.getElementById('turnCounter').innerText = state.turn;
        document.getElementById('lightCounter').innerText = state.lightOn ? state.torch : "OFF";
    };

    // Bloqueo de Movimiento
    OBR.scene.items.onChange(async (items) => {
        const updates = [];
        const grid = await OBR.scene.grid.getScale();
        const tokens = items.filter(i => i.layer === "CHARACTER");

        for (const token of tokens) {
            let start = token.metadata[M_ID];
            if (!start || start.turn !== state.turn) {
                updates.push({ id: token.id, metadata: { ...token.metadata, [M_ID]: { x: token.position.x, y: token.position.y, turn: state.turn } } });
                continue;
            }

            const dist = await OBR.scene.grid.distanceBetween({ x: start.x, y: start.y }, token.position);
            if (dist > state.limit + 1) {
                updates.push({ id: token.id, position: { x: start.x, y: start.y } });
                OBR.notification.show("Límite de movimiento alcanzado.");
            }
        }
        if (updates.length > 0) await OBR.scene.items.updateItems(updates.map(u => u.id), (items) => {
            updates.forEach(u => {
                const item = items.find(i => i.id === u.id);
                if (u.position) item.position = u.position;
                if (u.metadata) item.metadata = u.metadata;
            });
        });
    });

    document.getElementById('nextTurnBtn').onclick = async () => {
        state.turn++;
        if (state.lightOn && state.torch > 0) state.torch--;
        await OBR.scene.setMetadata({ [M_ID]: state });
        const tokens = await OBR.scene.items.getItems(i => i.layer === "CHARACTER");
        await OBR.scene.items.updateItems(tokens.map(t => t.id), (items) => {
            items.forEach(item => item.metadata[M_ID] = { x: item.position.x, y: item.position.y, turn: state.turn });
        });
        load();
    };

    await load();
});

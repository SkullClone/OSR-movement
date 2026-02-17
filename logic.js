const M_KEY = "com.skullclone.osr_move";

let _isUpdating = false;

OBR.onReady(async () => {
    const turnSpan           = document.getElementById('turnCounter');
    const lightSpan          = document.getElementById('lightCounter');
    const lightToggle        = document.getElementById('lightToggle');
    const moveLimitInput     = document.getElementById('moveLimit');
    const encounterFreqInput = document.getElementById('encounterFreq');
    const applyToGmCheck     = document.getElementById('applyToGm');
    const nextTurnBtn        = document.getElementById('nextTurn');
    const rollEncounterBtn   = document.getElementById('rollEncounter');
    const rollResult         = document.getElementById('rollResult');

    let state = {
        turn: 1,
        lightOn: false,
        lightRemaining: 6,
        moveLimit: 120,
        encounterFreq: 2,
        applyToGM: false
    };

    // ─── Persistencia ────────────────────────────────────────────────────────

    const load = async () => {
        const meta = await OBR.scene.getMetadata();
        if (meta[M_KEY]) state = { ...state, ...meta[M_KEY] };
        updateUI();
    };

    const save = async () => {
        const currentMeta = await OBR.scene.getMetadata();
        const merged = { ...currentMeta[M_KEY], ...state };
        await OBR.scene.setMetadata({ [M_KEY]: merged });
        updateUI();
    };

    const updateUI = () => {
        turnSpan.textContent         = state.turn;
        lightToggle.textContent      = state.lightOn ? 'LUZ: ON' : 'LUZ: OFF';
        lightToggle.style.background = state.lightOn ? "#442200" : "#2a2a2a";
        moveLimitInput.value         = state.moveLimit;
        encounterFreqInput.value     = state.encounterFreq;
        applyToGmCheck.checked       = state.applyToGM;

        if (!state.lightOn) {
            lightSpan.textContent = 'OFF';
            lightSpan.classList.remove('warn');
        } else {
            lightSpan.textContent = state.lightRemaining;
            lightSpan.classList.toggle('warn', state.lightRemaining <= 2);
        }
    };

    // ─── Gestión de luz ──────────────────────────────────────────────────────

    const tickLight = async () => {
        if (!state.lightOn) return;
        state.lightRemaining--;
        if (state.lightRemaining <= 0) {
            state.lightRemaining = 0;
            state.lightOn = false;
            await OBR.notification.show('🔥 ¡La antorcha se ha agotado!', 'WARNING');
        }
    };

    // ─── Tirada de encuentro ─────────────────────────────────────────────────

    const rollEncounterDie = async () => {
        rollEncounterBtn.disabled = true;
        rollResult.textContent    = 'Tirando...';
        try {
            const result = Math.floor(Math.random() * 6) + 1;
            const freq   = state.encounterFreq;
            const isEncounter = result <= freq;

            rollResult.textContent = isEncounter
                ? `🎲 ${result} — ¡ENCUENTRO!`
                : `🎲 ${result} — Despejado`;
            rollResult.style.color = isEncounter ? '#ff4444' : '#33ff33';

            if (isEncounter) {
                await OBR.notification.show(
                    `⚠️ ¡Encuentro errante! (${result} en 1d6, frec. ${freq})`,
                    'ERROR'
                );
            }
        } catch (e) {
            console.error(e);
        } finally {
            rollEncounterBtn.disabled = false;
        }
    };

    // ─── Bloqueo de movimiento ───────────────────────────────────────────────

    OBR.scene.items.onChange(async (items) => {
        if (_isUpdating) return;

        const tokens = items.filter(i => i.layer === 'CHARACTER');
        if (tokens.length === 0) return;

        const myRole  = await OBR.player.getRole();
        const myId    = await OBR.player.getId();
        const players = await OBR.player.getPlayers();
        const gmIds   = new Set(
            players.filter(p => p.role === 'GM').map(p => p.id)
        );
        if (myRole === 'GM') gmIds.add(myId);

        const positionUpdates = [];
        const metaUpdates     = [];

        for (const token of tokens) {
            const savedMeta = token.metadata?.[M_KEY];

            if (!savedMeta || savedMeta.turn !== state.turn) {
                metaUpdates.push({
                    id: token.id,
                    metadata: {
                        ...token.metadata,
                        [M_KEY]: {
                            x: token.position.x,
                            y: token.position.y,
                            turn: state.turn
                        }
                    }
                });
                continue;
            }

            const isGmToken = gmIds.has(token.createdUserId);
            if (isGmToken && !state.applyToGM) continue;

            const origin  = { x: Number(savedMeta.x), y: Number(savedMeta.y) };
            const current = { x: token.position.x,    y: token.position.y    };

            if (origin.x === current.x && origin.y === current.y) continue;

            const dist = await OBR.scene.grid.distanceBetween(origin, current);

            if (dist > state.moveLimit + 0.5) {
                positionUpdates.push({ id: token.id, position: origin });
                await OBR.notification.show(
                    `Límite de movimiento: ${state.moveLimit} pies alcanzado`,
                    'WARNING'
                );
            }
        }

        if (positionUpdates.length > 0) {
            _isUpdating = true;
            try {
                await OBR.scene.items.updateItems(
                    positionUpdates.map(u => u.id),
                    (itemsToUpdate) => {
                        itemsToUpdate.forEach(item => {
                            const u = positionUpdates.find(p => p.id === item.id);
                            if (u) item.position = u.position;
                        });
                    }
                );
            } finally {
                _isUpdating = false;
            }
        }

        if (metaUpdates.length > 0) {
            _isUpdating = true;
            try {
                await OBR.scene.items.updateItems(
                    metaUpdates.map(u => u.id),
                    (itemsToUpdate) => {
                        itemsToUpdate.forEach(item => {
                            const u = metaUpdates.find(m => m.id === item.id);
                            if (u) item.metadata = u.metadata;
                        });
                    }
                );
            } finally {
                _isUpdating = false;
            }
        }
    });

    // ─── Siguiente turno ─────────────────────────────────────────────────────

    nextTurnBtn.onclick = async () => {
        state.turn++;
        await tickLight();

        if (state.turn % state.encounterFreq === 0) {
            await OBR.notification.show('¡Turno de tirada de encuentro!', 'INFO');
        }

        const allTokens = await OBR.scene.items.getItems(
            i => i.layer === 'CHARACTER'
        );

        if (allTokens.length > 0) {
            _isUpdating = true;
            try {
                await OBR.scene.items.updateItems(
                    allTokens.map(t => t.id),
                    (itemsToUpdate) => {
                        itemsToUpdate.forEach(item => {
                            item.metadata = {
                                ...item.metadata,
                                [M_KEY]: {
                                    x: item.position.x,
                                    y: item.position.y,
                                    turn: state.turn
                                }
                            };
                        });
                    }
                );
            } finally {
                _isUpdating = false;
            }
        }

        await save();
        await OBR.notification.show(`Turno ${state.turn} iniciado`, 'DEFAULT');
    };

    // ─── Eventos de UI ───────────────────────────────────────────────────────

    lightToggle.onclick = () => {
        state.lightOn = !state.lightOn;
        if (state.lightOn && state.lightRemaining === 0) state.lightRemaining = 6;
        save();
    };

    rollEncounterBtn.onclick = rollEncounterDie;

    moveLimitInput.onchange = () => {
        state.moveLimit = parseInt(moveLimitInput.value) || 120;
        save();
    };

    encounterFreqInput.onchange = () => {
        state.encounterFreq = parseInt(encounterFreqInput.value) || 2;
        save();
    };

    applyToGmCheck.onchange = () => {
        state.applyToGM = applyToGmCheck.checked;
        save();
    };

    // ─── Inicio ──────────────────────────────────────────────────────────────
    await load();
});

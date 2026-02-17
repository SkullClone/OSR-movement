(function() {
    const METADATA_KEY = "com.skullclone.osr_move";

    OBR.onReady(async () => {
        // Elementos DOM
        const turnSpan = document.getElementById('turnCounter');
        const lightSpan = document.getElementById('lightCounter');
        const lightToggle = document.getElementById('lightToggle');
        const moveLimitInput = document.getElementById('moveLimit');
        const encounterFreqInput = document.getElementById('encounterFreq');
        const applyToGmCheck = document.getElementById('applyToGm');
        const nextTurnBtn = document.getElementById('nextTurn');

        // Estado (se cargará desde metadatos de la escena)
        let state = {
            turn: 1,
            lightOn: false,
            lightRemaining: 6,
            moveLimit: 30,
            encounterFreq: 6,
            applyToGM: false
        };

        // Cargar estado guardado
        await loadState();

        // Actualizar UI
        updateUI();

        // --- Lógica de bloqueo de movimiento ---
        OBR.scene.items.onChange(async (changedItems) => {
            const limitFeet = state.moveLimit;
            const restrictGM = state.applyToGM;
            const tokens = changedItems.filter(i => i.type === 'CHARACTER');
            if (tokens.length === 0) return;

            // Obtener jugadores GM para la comprobación
            const players = await OBR.player.getPlayers();
            const gmIds = players.filter(p => p.role === 'GM').map(p => p.id);

            const updates = [];

            for (const token of tokens) {
                // Posición inicial guardada (si no existe, la guardamos ahora)
                let startPos = token.metadata?.[METADATA_KEY];
                if (!startPos) {
                    // Si no tiene metadato, se lo asignamos (primera vez)
                    updates.push({
                        id: token.id,
                        metadata: { [METADATA_KEY]: { x: token.x, y: token.y, turn: state.turn } }
                    });
                    continue;
                }

                // Si la posición inicial es de un turno anterior, la actualizamos silenciosamente
                if (startPos.turn !== state.turn) {
                    updates.push({
                        id: token.id,
                        metadata: { [METADATA_KEY]: { x: token.x, y: token.y, turn: state.turn } }
                    });
                    continue;
                }

                // Comprobar si debemos aplicar restricción a este token
                let shouldRestrict = true;
                if (!restrictGM) {
                    // Si el token fue creado por un GM, no lo restringimos
                    if (gmIds.includes(token.createdUserId)) {
                        shouldRestrict = false;
                    }
                }

                if (shouldRestrict) {
                    // Calcular distancia recorrida (en pies)
                    const distance = await OBR.scene.grid.distanceBetween(
                        { x: startPos.x, y: startPos.y },
                        { x: token.x, y: token.y }
                    );

                    if (distance > limitFeet + 0.1) { // pequeño margen
                        // Revertir posición
                        updates.push({
                            id: token.id,
                            position: { x: startPos.x, y: startPos.y }
                        });
                        OBR.notification.show(`Movimiento excede ${limitFeet} pies`, 'WARNING');
                    }
                }
            }

            if (updates.length > 0) {
                await OBR.scene.items.updateItems(updates);
            }
        });

        // --- Botón Siguiente Turno ---
        nextTurnBtn.addEventListener('click', async () => {
            state.turn++;
            if (state.lightOn && state.lightRemaining > 0) {
                state.lightRemaining--;
            }

            // Comprobar encuentro
            if (state.turn % state.encounterFreq === 0) {
                OBR.notification.show('¡Tirada de encuentro!', 'INFO');
            }

            // Resetear posiciones iniciales de todos los tokens
            const allTokens = await OBR.scene.items.getItems(i => i.type === 'CHARACTER');
            const resetUpdates = allTokens.map(t => ({
                id: t.id,
                metadata: { [METADATA_KEY]: { x: t.x, y: t.y, turn: state.turn } }
            }));
            if (resetUpdates.length > 0) {
                await OBR.scene.items.updateItems(resetUpdates);
            }

            await saveState();
            updateUI();
        });

        // --- Botón Luz ---
        lightToggle.addEventListener('click', async () => {
            state.lightOn = !state.lightOn;
            if (state.lightOn && state.lightRemaining === 0) {
                state.lightRemaining = 6; // Reiniciar si estaba a 0
            }
            await saveState();
            updateUI();
        });

        // --- Inputs ---
        moveLimitInput.addEventListener('change', () => {
            state.moveLimit = parseInt(moveLimitInput.value, 10) || 30;
            saveState();
        });
        encounterFreqInput.addEventListener('change', () => {
            state.encounterFreq = parseInt(encounterFreqInput.value, 10) || 6;
            saveState();
        });
        applyToGmCheck.addEventListener('change', () => {
            state.applyToGM = applyToGmCheck.checked;
            saveState();
        });

        // --- Funciones de persistencia ---
        async function loadState() {
            const meta = await OBR.scene.getMetadata() || {};
            const saved = meta[METADATA_KEY] || {};
            state.turn = saved.turn ?? 1;
            state.lightOn = saved.lightOn ?? false;
            state.lightRemaining = saved.lightRemaining ?? 6;
            state.moveLimit = saved.moveLimit ?? 30;
            state.encounterFreq = saved.encounterFreq ?? 6;
            state.applyToGM = saved.applyToGM ?? false;
        }

        async function saveState() {
            await OBR.scene.setMetadata({
                [METADATA_KEY]: {
                    turn: state.turn,
                    lightOn: state.lightOn,
                    lightRemaining: state.lightRemaining,
                    moveLimit: state.moveLimit,
                    encounterFreq: state.encounterFreq,
                    applyToGM: state.applyToGM
                }
            });
            updateUI();
        }

        function updateUI() {
            turnSpan.textContent = state.turn;
            lightSpan.textContent = state.lightOn ? state.lightRemaining : 'OFF';
            lightToggle.textContent = state.lightOn ? 'APAGAR' : 'ENCENDER';
            lightToggle.style.background = state.lightOn ? '#430' : '#2a2a2a';
            moveLimitInput.value = state.moveLimit;
            encounterFreqInput.value = state.encounterFreq;
            applyToGmCheck.checked = state.applyToGM;
        }
    });
})();

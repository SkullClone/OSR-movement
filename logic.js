const M_ID = "com.skullclone.ose_sheet";

OBR.onReady(async () => {
    const sheet = document.getElementById('sheet');
    const noSelection = document.getElementById('no-selection');

    // Función para mapear los inputs
    const getFields = () => ({
        name: document.getElementById('charName'),
        class: document.getElementById('charClass'),
        level: document.getElementById('level'),
        str: document.getElementById('str'),
        int: document.getElementById('int'),
        wis: document.getElementById('wis'),
        dex: document.getElementById('dex'),
        con: document.getElementById('con'),
        cha: document.getElementById('cha'),
        hp: document.getElementById('hp'),
        hpMax: document.getElementById('hpMax'),
        ac: document.getElementById('ac'),
        sDeath: document.getElementById('sDeath'),
        sWands: document.getElementById('sWands'),
        sPara: document.getElementById('sPara'),
        sBreath: document.getElementById('sBreath'),
        sSpell: document.getElementById('sSpell')
    });

    // Cargar datos del token seleccionado
    async function loadSelectedToken() {
        const selection = await OBR.player.getSelection();
        if (!selection || selection.length === 0) {
            sheet.style.display = 'none';
            noSelection.style.display = 'block';
            return;
        }

        const items = await OBR.scene.items.getItems([selection[0]]);
        const token = items[0];

        if (token) {
            sheet.style.display = 'block';
            noSelection.style.display = 'none';
            const data = token.metadata[M_ID] || {};
            const fields = getFields();
            
            // Rellenar la ficha
            for (let key in fields) {
                fields[key].value = data[key] || (fields[key].type === "number" ? 0 : "");
            }
        }
    }

    // Guardar datos en el token
    document.getElementById('saveBtn').onclick = async () => {
        const selection = await OBR.player.getSelection();
        if (!selection) return;

        const fields = getFields();
        const data = {};
        for (let key in fields) {
            data[key] = fields[key].value;
        }

        await OBR.scene.items.updateItems(selection, (items) => {
            for (let item of items) {
                item.metadata[M_ID] = data;
            }
        });
        OBR.notification.show("Ficha actualizada");
    };

    // Detectar cuando el usuario cambia de selección
    OBR.player.onSelectionChange(() => {
        loadSelectedToken();
    });

    // Carga inicial
    loadSelectedToken();
});

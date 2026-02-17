const M_ID = "com.skullclone.ose_sheet";

OBR.onReady(async () => {
    const sheet = document.getElementById('sheet');
    const noSelection = document.getElementById('no-selection');

    const fields = [
        'name', 'class', 'str', 'int', 'wis', 'dex', 'con', 'cha',
        'hp', 'hpMax', 'ac', 'thac0', 'sDeath', 'sWands', 'sPara', 'sBreath', 'sSpell'
    ];

    async function updateSheet() {
        const selection = await OBR.player.getSelection();
        if (!selection || selection.length === 0) {
            sheet.style.display = 'none';
            noSelection.style.display = 'block';
            return;
        }

        const items = await OBR.scene.items.getItems([selection[0]]);
        const token = items[0];

        if (token && token.layer === "CHARACTER") {
            sheet.style.display = 'block';
            noSelection.style.display = 'none';
            const data = token.metadata[M_ID] || {};
            fields.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = data[id] || "";
            });
        } else {
            sheet.style.display = 'none';
            noSelection.style.display = 'block';
            noSelection.innerText = "SELECCIONA UN TOKEN DE PERSONAJE";
        }
    }

    document.getElementById('saveBtn').onclick = async () => {
        const selection = await OBR.player.getSelection();
        if (!selection || selection.length === 0) return;

        const data = {};
        fields.forEach(id => {
            data[id] = document.getElementById(id).value;
        });

        await OBR.scene.items.updateItems(selection, (items) => {
            items.forEach(item => {
                item.metadata[M_ID] = data;
            });
        });
        OBR.notification.show("Ficha OSE Guardada");
    };

    OBR.player.onSelectionChange(() => updateSheet());
    updateSheet();
});

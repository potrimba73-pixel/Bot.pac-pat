import fs from "fs";

const DB_FILE = "./tickets.json";

export let db = { tickets: {}, messages: {}, acceptedRules: [], avaliacoes: {} };

export function loadDB() {
    if (fs.existsSync(DB_FILE)) {
        try {
            db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
        } catch (e) {
            console.error("Erro ao carregar DB:", e);
        }
    }
}

export function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("Erro ao guardar DB:", e);
    }
}

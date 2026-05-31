import fs from "fs";
import { writeFile } from "fs/promises";

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

let saving = false;
let pendingSave = false;

export async function saveDB() {
    if (saving) {
        pendingSave = true;
        return;
    }
    saving = true;
    try {
        await writeFile(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("Erro ao guardar DB:", e);
    } finally {
        saving = false;
        if (pendingSave) {
            pendingSave = false;
            await saveDB();
        }
    }
}

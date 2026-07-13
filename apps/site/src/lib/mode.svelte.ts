import { browser } from '$app/environment';

export type Mode = 'light' | 'dark' | 'system';
export type ResolvedMode = 'light' | 'dark';

const STORAGE_KEY = 'mode';
const DEFAULT_MODE: Mode = 'dark';

function readStored(): Mode {
    if (!browser) return DEFAULT_MODE;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : DEFAULT_MODE;
}

function systemPrefersDark(): boolean {
    return browser && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

class ModeState {
    #mode = $state<Mode>(readStored());

    get preference(): Mode {
        return this.#mode;
    }

    get current(): ResolvedMode {
        if (this.#mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
        return this.#mode;
    }

    set(mode: Mode) {
        this.#mode = mode;
        if (browser) localStorage.setItem(STORAGE_KEY, mode);
        this.apply();
    }

    toggle() {
        this.set(this.current === 'dark' ? 'light' : 'dark');
    }

    apply() {
        if (!browser) return;
        const html = document.documentElement;
        html.classList.toggle('light', this.current === 'light');
        html.style.colorScheme = this.current;
    }
}

export const mode = new ModeState();

export function setMode(value: Mode) {
    mode.set(value);
}

export function toggleMode() {
    mode.toggle();
}

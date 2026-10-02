// Точка входа движка для браузера: esbuild собирает её в IIFE и кладёт в страницу демо
import { anonKey, demoFetch, startEngine } from './engine';

(window as unknown as { ParriEngine: unknown }).ParriEngine = { startEngine, demoFetch, anonKey };

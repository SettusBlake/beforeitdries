/*
 * Einstieg für das Ziehen in der App, wird erst beim Öffnen der Würfel nachgeladen.
 * PixiJS ohne eval: Reddits Webview erlaubt kein unsafe-eval.
 */
import 'pixi.js/unsafe-eval';

export { Reveal, type RevealPull } from './reveal';

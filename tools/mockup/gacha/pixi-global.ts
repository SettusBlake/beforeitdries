/*
 * Im Artifact kommt PixiJS als fertige Datei vom CDN (globales PIXI). Der Build leitet 'pixi.js' hierher um.
 */
declare const PIXI: typeof import('pixi.js');
export const { Application, BlurFilter, Container, DisplacementFilter, Graphics, Sprite, Text, Texture } = PIXI;

#!/usr/bin/env node

/**
 * Render Utils
 * Styling utilities for custom renderers
 */

import chalk from "chalk";

/**
 * Style error text
 * Accepts theme for compatibility, falls back to chalk.red
 */
export function styleError(themeOrText: any, text?: string): string {
  if (typeof themeOrText === "string") {
    return chalk.red(themeOrText);
  }
  const theme = themeOrText;
  return theme.fg ? theme.fg("error", text || "") : chalk.red(text || "");
}

/**
 * Style success text
 */
export function styleSuccess(themeOrText: any, text?: string): string {
  if (typeof themeOrText === "string") {
    return chalk.green(themeOrText);
  }
  const theme = themeOrText;
  return theme.fg ? theme.fg("success", text || "") : chalk.green(text || "");
}

/**
 * Style warning text
 */
export function styleWarning(themeOrText: any, text?: string): string {
  if (typeof themeOrText === "string") {
    return chalk.yellow(themeOrText);
  }
  const theme = themeOrText;
  return theme.fg ? theme.fg("warning", text || "") : chalk.yellow(text || "");
}

/**
 * Style normal text
 */
export function styleText(themeOrText: any, text?: string): string {
  if (typeof themeOrText === "string") {
    return chalk.white(themeOrText);
  }
  const theme = themeOrText;
  return theme.fg ? theme.fg("text", text || "") : chalk.white(text || "");
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Pad text to width
 */
export function pad(text: string, width: number): string {
  return text.padEnd(width);
}

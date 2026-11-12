// lib/fontOverride.js
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { FONTS } from './fonts';

const oldRender = Text.render;

Text.render = function (...args) {
  const origin = oldRender.call(this, ...args);

  if (!origin || !origin.props) {
    return origin;
  }

  const originalStyle = origin.props.style;
  const props = origin.props;

  // 1. Deeply flatten styles to handle arrays, nested styles, and StyleSheet objects
  const flattenedStyle = StyleSheet.flatten(originalStyle) || {};

  // 2. Escape Hatch: If a font family is explicitly defined locally, do not override
  if (flattenedStyle.fontFamily) {
    return origin;
  }

  let targetFont = FONTS.kaysteve; // Default baseline (Sidebar menu / general body text)

  // 3. Detect Headers, Titles, and Buttons -> Havoc
  const isHeaderRole = 
    props.accessibilityRole === 'header' || 
    props.role === 'header' ||
    flattenedStyle.isHeader || 
    flattenedStyle.isTitle || 
    flattenedStyle.isButton ||
    flattenedStyle.fontWeight === 'bold' || 
    flattenedStyle.fontWeight === '700' || 
    (flattenedStyle.fontSize && flattenedStyle.fontSize >= 18);

  // 4. Detect Media Details -> Last Honey
  const isMediaRole = 
    flattenedStyle.isMediaDetail || 
    flattenedStyle.isMedia || 
    flattenedStyle.mediaContext ||
    props.isMediaDetail ||
    props.isMedia;

  if (isHeaderRole) {
    targetFont = FONTS.havoc;
  } else if (isMediaRole) {
    targetFont = FONTS.lastHoney;
  } else {
    targetFont = FONTS.kaysteve;
  }

  // 5. Prevent infinite rendering loops by checking if the exact style is already applied
  if (flattenedStyle.fontFamily === targetFont) {
    return origin;
  }

  // 6. Clone and safely inject the resolved font alongside original styling
  return React.cloneElement(origin, {
    style: [originalStyle, { fontFamily: targetFont }],
  });
};

import * as WebBrowser from "expo-web-browser";
import React, { useMemo } from "react";
import { Linking, StyleProp, TextStyle } from "react-native";
import { Text } from "react-native-paper";

import { useAppTheme } from "@/types";

interface RichHtmlTextProps {
  html: string;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function RichHtmlText({
  html,
  numberOfLines,
  style,
}: RichHtmlTextProps) {
  const theme = useAppTheme();

  const handleOpenLink = async (url: string) => {
    try {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        await WebBrowser.openBrowserAsync(url);
      } else {
        await Linking.openURL(url);
      }
    } catch (e) {
      console.warn("failed to open link:", e);
    }
  };

  const elements = useMemo(() => {
    if (!html) return null;

    const tokens = html.split(
      /(<\/?(?:a|b|strong|i|em|p|br)(?:(?:\s+[^>]*)|)>)/gi,
    );

    let currentHref: string | null = null;
    let isBold = false;
    let isItalic = false;

    const result: React.ReactNode[] = [];
    let keyIdx = 0;

    for (const token of tokens) {
      if (!token) continue;

      const lower = token.toLowerCase();

      if (lower.startsWith("<a")) {
        const hrefMatch = token.match(/href=["']([^"']+)["']/i);
        currentHref = hrefMatch ? hrefMatch[1] : null;
      } else if (lower === "</a>") {
        currentHref = null;
      } else if (lower === "<b>" || lower === "<strong>") {
        isBold = true;
      } else if (lower === "</b>" || lower === "</strong>") {
        isBold = false;
      } else if (lower === "<i>" || lower === "<em>") {
        isItalic = true;
      } else if (lower === "</i>" || lower === "</em>") {
        isItalic = false;
      } else if (lower.startsWith("<br") || lower === "<p>") {
        result.push("\n");
      } else if (lower === "</p>") {
        result.push("\n\n");
      } else if (!token.startsWith("<")) {
        const decodedText = decodeHtmlEntities(token);
        const linkUrl = currentHref;

        const inlineStyle: TextStyle = {};
        if (isBold) inlineStyle.fontWeight = "bold";
        if (isItalic) inlineStyle.fontStyle = "italic";
        if (linkUrl) {
          inlineStyle.color = theme.colors.primary;
          inlineStyle.textDecorationLine = "underline";
        }

        if (linkUrl) {
          result.push(
            <Text
              key={`rich-${keyIdx++}`}
              style={inlineStyle}
              onPress={() => handleOpenLink(linkUrl)}
            >
              {decodedText}
            </Text>,
          );
        } else if (isBold || isItalic) {
          result.push(
            <Text key={`rich-${keyIdx++}`} style={inlineStyle}>
              {decodedText}
            </Text>,
          );
        } else {
          result.push(decodedText);
        }
      }
    }

    return result;
  }, [html, theme.colors.primary]);

  return (
    <Text variant="bodyMedium" numberOfLines={numberOfLines} style={style}>
      {elements}
    </Text>
  );
}

import {
  AccordionItem,
  AccordionContent,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Switch } from "@/components/ui/switch";
import { useConfig } from './ConfigContext';
import { SettingTitle } from './SettingsTitle';
import { useState, useEffect, useCallback } from 'react';
import { Config } from '../types/config';
import storage from '../background/storageUtil';
import { ColorPicker, useColor, IColor } from 'react-color-palette';
import 'react-color-palette/css';
import { cn } from "@/src/background/util";

export type Theme = {
  name: string;
  active: string;
  bg: string;
  text: string;
  bold: string;
  italic: string;
  link: string;
  codeBg: string;
  codeFg: string;
  preBg: string;
  mute: string;
  preFg: string;
  tableBorder: string;
  error: string;
  success: string;
  warning: string;
};

export const themes: Theme[] = [
  {
    name: 'paper',
    active: '#dcc299',
    bg: '#F5E9D5',
    text: '#5B4636',
    bold: '#af1b1b',
    italic: '#036427',
    link: '#003bb9',
    codeBg: '#5B4636',
    codeFg: '#F5E9D5',
    preBg: '#5B4636',
    preFg: '#F5E9D5',
    mute: '#A08C7D',
    tableBorder: '#5B4636',
    error: '#d32f2f',
    success: '#388e3c',
    warning: '#fbc02d',
  },
  {
    name: 'smoke',
    active: '#787878',
    bg: '#91989F',
    text: '#FCFAF2',
    bold: '#E9CD4C',
    italic: '#A8D8B9',
    link: '#546485',
    codeBg: '#FCFAF2',
    codeFg: '#91989F',
    preBg: '#FCFAF2',
    preFg: '#91989F',
    mute: '#fcfaf27f', 
    tableBorder: '#FCFAF2',
    error: '#d32f2f',
    success: '#388e3c',
    warning: '#fbc02d',
  },
  {
    name: 'moss',
    active: '#a4b086',
    bg: '#EFD6AC',
    text: '#333333',
    bold: '#af1b1b',
    italic: '#6349b3',
    link: '#4367b6',
    codeBg: '#333333',
    codeFg: '#EFD6AC',
    preBg: '#333333',
    preFg: '#EFD6AC',
    mute: '#7F7F7F',
    tableBorder: '#6349b3',
    error: '#d32f2f',
    success: '#388e3c',
    warning: '#fbc02d',
  },
  {
    name: 'light',
    active: '#E0EFFF',
    bg: '#FFFFFF', 
    text: '#212529', 
    bold: '#004080', 
    italic: '#555555', 
    link: '#0056b3', 
    codeBg: '#F8F9FA',
    codeFg: '#212529', 
    preBg: '#F8F9FA',  
    preFg: '#212529', 
    mute: '#6C757D',    
    tableBorder: '#DEE2E6', 
    error: '#d32f2f',
    success: '#388e3c',
    warning: '#fbc02d',
  },
  {
    name: 'dark',
    active: '#7473af',
    bg: '#373737',
    text: '#e3e3e3',
    bold: '#eb9500',
    italic: '#97e9b5',
    link: '#8aa8e8',
    codeBg: '#e3e3e3',
    codeFg: '#373737',
    preBg: '#e3e3e3',
    preFg: '#373737',
    mute: '#A9A9A9',
    tableBorder: '#e3e3e3',
    error: '#d32f2f',
    success: '#388e3c',
    warning: '#fbc02d',
  },
  {
    name: 'custom', 
    active: '#7473af', bg: '#393939', text: '#e3e3e3', bold: '#af1b1b',
    italic: '#09993e', link: '#003bb9', codeBg: '#e3e3e3', codeFg: '#393939',
    preBg: '#e3e3e3', preFg: '#393939', mute: '#A9A9A9', tableBorder: '#e3e3e3',
    error: '#d32f2f', success: '#388e3c', warning: '#fbc02d',
  },
];

function isColorDark(color: string): boolean {
  // Handle empty/invalid input
  if (!color) return false;

  // Remove opacity if present
  const hex = color.replace(/[^0-9a-f]/gi, '');
  
  // Handle 3, 4, 6 or 8 digit hex
  let r, g, b;
  if (hex.length <= 4) {
    // 3 or 4 digits (RGB or RGBA)
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else {
    // 6 or 8 digits (RRGGBB or RRGGBBAA)
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }

  // Check if parsing was successful
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false;

  // Calculate perceived brightness using YIQ formula
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
}

export const setTheme = (c: Theme, paperTextureEnabled: boolean = true) => {
  const root = document.documentElement;
  document.documentElement.dataset.paperTexture = String(paperTextureEnabled);

  if (!c) {
    console.error("setTheme called with undefined theme object");
    return;
  }

  // Improved dark theme detection
  const isDarkBg = c.bg && isColorDark(c.bg);
  const isDarkTheme = c.name === 'dark' || (c.name === 'custom' && isDarkBg);
  root.dataset.theme = isDarkTheme ? 'dark' : 'light';
  
  if (isDarkTheme) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  const convertHexToRGBA = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const a = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };

  // When getting colors, convert 8-digit hex to rgba
  const bg = convertHexToRGBA(c.bg || '#ffffff');
  const text = convertHexToRGBA(c.text || '#000000');
  const active = convertHexToRGBA(c.active || '#007bff');
  const bold = convertHexToRGBA(c.bold || '#000000');
  const italic = convertHexToRGBA(c.italic || '#000000');
  const link = convertHexToRGBA(c.link || '#007bff');
  const codeBg = convertHexToRGBA(c.codeBg || text);
  const codeFg = convertHexToRGBA(c.codeFg || bg);
  const preBg = convertHexToRGBA(c.preBg || text);
  const preFg = convertHexToRGBA(c.preFg || bg);
  const mute = convertHexToRGBA(c.mute || '#75757580');
  const tableBorder = convertHexToRGBA(c.tableBorder || text);
  const errorColor = convertHexToRGBA(c.error || '#d32f2f');
  const successColor = convertHexToRGBA(c.success || '#388e3c');
  const warningColor = convertHexToRGBA(c.warning || '#fbc02d');

  root.style.setProperty('--background', bg);
  root.style.setProperty('--foreground', text);
  root.style.setProperty('--card', bg);
  root.style.setProperty('--card-foreground', text);
  root.style.setProperty('--popover', bg);
  root.style.setProperty('--popover-foreground', text);
  root.style.setProperty('--primary', active);
  root.style.setProperty('--primary-foreground', bg);
  root.style.setProperty('--secondary', active);
  root.style.setProperty('--secondary-foreground', bg);
  root.style.setProperty('--muted', codeBg);
  root.style.setProperty('--muted-foreground', mute);
  root.style.setProperty('--accent', active);
  root.style.setProperty('--accent-foreground', bg);
  root.style.setProperty('--destructive', errorColor);
  root.style.setProperty('--destructive-foreground', bg);
  root.style.setProperty('--border', text);
  root.style.setProperty('--input', text);
  root.style.setProperty('--ring', active);

  root.style.setProperty('--markdown-h1', bold);
  root.style.setProperty('--markdown-h2', italic);
  root.style.setProperty('--markdown-h3', text);
  root.style.setProperty('--markdown-strong', bold);
  root.style.setProperty('--markdown-em', italic);
  root.style.setProperty('--markdown-link', link);
  root.style.setProperty('--markdown-inline-code-foreground', codeFg);
  root.style.setProperty('--markdown-code-background', codeBg);
  root.style.setProperty('--markdown-pre-foreground', preFg);
  root.style.setProperty('--markdown-pre-background', preBg);
  root.style.setProperty('--markdown-table-border', tableBorder);
  root.style.setProperty('--markdown-thead-background', active);
  root.style.setProperty('--markdown-thead-foreground', bg);

  root.style.setProperty('--bold', bold);
  root.style.setProperty('--italic', italic);
  root.style.setProperty('--link', link);
  root.style.setProperty('--error', errorColor);
  root.style.setProperty('--success', successColor);
  root.style.setProperty('--warning', warningColor);
  root.style.setProperty('--bg', bg);
  root.style.setProperty('--text', text);
  root.style.setProperty('--active', active);
};

const PaletteColorPicker = ({
  initialColor,
  onColorChangeComplete,
  themeKey,
}: {
  initialColor: string;
  onColorChangeComplete: (key: keyof Omit<Theme, 'name'>, color: IColor) => void;
  themeKey: keyof Omit<Theme, 'name'>;
}) => {
  // Always normalize to #RRGGBBAA
  const normalizedHex = normalizeColor(initialColor);

  // Use the color-palette hook directly
  const [color, setColor] = useColor(normalizedHex);

  const handleChange = (newColor: IColor) => {
    setColor(newColor);
  };

  const handleComplete = (finalColor: IColor) => {
    // Always output #RRGGBBAA (never longer)
    let hex = finalColor.hex.slice(0, 7);
    if (finalColor.rgb.a !== undefined && finalColor.rgb.a < 1) {
      const alphaHex = Math.round(finalColor.rgb.a * 255)
        .toString(16)
        .padStart(2, '0');
      hex += alphaHex;
    } else {
      hex += 'ff';
    }
    hex = hex.slice(0, 9);

    // Don't mutate finalColor, create a new object
    onColorChangeComplete(themeKey, { ...finalColor, hex });
  };

  return (
    <div className="p-3">
      <ColorPicker
        color={color}
        onChange={handleChange}
        onChangeComplete={handleComplete}
      />
    </div>
  );
};

const DEFAULT_CUSTOM_THEME_FALLBACK: Theme = {
  name: 'custom',
  active: '#b5d4aa', bg: '#245612', text: '#efeaea', bold: '#fbd709',
  italic: '#09993e', link: '#587bc5', mute: '#B0B0B0', codeBg: '#efeaea', codeFg: '#245612',
  preBg: '#efeaea', preFg: '#245612', tableBorder: '#efeaea',
  error: '#fbd709', success: '#587bc5', warning: '#fbd709',
};


export const Themes = () => {
  const { config, updateConfig } = useConfig();
  const currentFontSize = config?.fontSize || 14;
  
  const [pickerVisibleForKey, setPickerVisibleForKey] = useState<keyof Omit<Theme, 'name'> | null>(null);
  const [customThemeColors, setCustomThemeColors] = useState<Omit<Theme, 'name'>>(() => { /* ...initialization logic... */
    const baseDefault = themes.find((t) => t.name === 'custom') || DEFAULT_CUSTOM_THEME_FALLBACK;
    const { name, ...restOfBaseDefault } = baseDefault;

    const configCustom = (typeof config?.customTheme === 'object' && config.customTheme !== null)
      ? config.customTheme
      : {};
    
    const mergedInitialState: Omit<Theme, 'name'> = {
        bg: configCustom.bg ?? restOfBaseDefault.bg,
        text: configCustom.text ?? restOfBaseDefault.text,
        active: configCustom.active ?? restOfBaseDefault.active,
        bold: configCustom.bold ?? restOfBaseDefault.bold,
        italic: configCustom.italic ?? restOfBaseDefault.italic,
        link: configCustom.link ?? restOfBaseDefault.link,
        codeBg: configCustom.codeBg ?? restOfBaseDefault.codeBg,
        codeFg: configCustom.codeFg ?? restOfBaseDefault.codeFg,
        preBg: configCustom.preBg ?? restOfBaseDefault.preBg,
        mute: configCustom.mute ?? restOfBaseDefault.mute,
        preFg: configCustom.preFg ?? restOfBaseDefault.preFg,
        tableBorder: configCustom.tableBorder ?? restOfBaseDefault.tableBorder,
        error: configCustom.error ?? restOfBaseDefault.error,
        success: configCustom.success ?? restOfBaseDefault.success,
        warning: configCustom.warning ?? restOfBaseDefault.warning,
    };
    return mergedInitialState;
  });

  useEffect(() => {
    if (config?.theme === 'custom') {
      const configCustom = (typeof config?.customTheme === 'object' && config.customTheme !== null)
        ? config.customTheme
        : {};
      const baseDefault = themes.find((t) => t.name === 'custom') || DEFAULT_CUSTOM_THEME_FALLBACK;
      const { name, ...restOfBaseDefault } = baseDefault;
      const newCustomColorsCandidate: Omit<Theme, 'name'> = {
        bg: configCustom.bg ?? restOfBaseDefault.bg,
        text: configCustom.text ?? restOfBaseDefault.text,
        active: configCustom.active ?? restOfBaseDefault.active,
        bold: configCustom.bold ?? restOfBaseDefault.bold,
        italic: configCustom.italic ?? restOfBaseDefault.italic,
        link: configCustom.link ?? restOfBaseDefault.link,
        codeBg: configCustom.codeBg ?? restOfBaseDefault.codeBg,
        codeFg: configCustom.codeFg ?? restOfBaseDefault.codeFg,
        preBg: configCustom.preBg ?? restOfBaseDefault.preBg,
        mute: configCustom.mute ?? restOfBaseDefault.mute,
        preFg: configCustom.preFg ?? restOfBaseDefault.preFg,
        tableBorder: configCustom.tableBorder ?? restOfBaseDefault.tableBorder,
        error: configCustom.error ?? restOfBaseDefault.error,
        success: configCustom.success ?? restOfBaseDefault.success,
        warning: configCustom.warning ?? restOfBaseDefault.warning,
      };
      if (JSON.stringify(customThemeColors) !== JSON.stringify(newCustomColorsCandidate)) {
        setCustomThemeColors(newCustomColorsCandidate);
      }
    }
  }, [config?.customTheme, config?.theme, customThemeColors]);

  const handleColorChange = useCallback((key: keyof Omit<Theme, 'name'>, colorResult: IColor) => {
    console.log(`Themes: handleColorChange called for key "${key}" with color`, colorResult.hex);
    const value = colorResult.hex;

    setCustomThemeColors(prevCustomColors => {
      let newThemeData = { ...prevCustomColors, [key]: value };
      if (key === 'text') {
        newThemeData.codeBg = value; newThemeData.preBg = value; newThemeData.tableBorder = value;
        newThemeData.error = newThemeData.bold || value; newThemeData.warning = newThemeData.bold || value;
        if (prevCustomColors.bg) { newThemeData.codeFg = prevCustomColors.bg; newThemeData.preFg = prevCustomColors.bg; }
        if (prevCustomColors.link) newThemeData.success = prevCustomColors.link;
      } else if (key === 'bg') {
        newThemeData.codeFg = value; newThemeData.preFg = value;
        if (prevCustomColors.text) { newThemeData.codeBg = prevCustomColors.text; newThemeData.preBg = prevCustomColors.text; }
      } else if (key === 'bold') {
        newThemeData.error = value; newThemeData.warning = value;
      } else if (key === 'link') {
        newThemeData.success = value;
      }
      
      console.log("Themes: Updating config with new customTheme and setting theme to 'custom'", newThemeData);
      updateConfig({
        customTheme: newThemeData,
        theme: 'custom',
      });
      return newThemeData;
    });
  }, [updateConfig]);

  const editableColorKeys: Array<keyof Omit<Theme, 'name'>> = ['bg', 'text', 'active', 'bold', 'italic', 'link', 'mute'];
  const effectiveCustomThemeForPickers: Theme = { ...customThemeColors, name: 'custom' };

  useEffect(() => {
    const currentThemeName = config?.theme || 'paper';
    const isCustom = currentThemeName === 'custom';
    let themeToApply: Theme | undefined;

    if (isCustom) {
      const baseCustomDefinition = themes.find((t) => t.name === 'custom') || DEFAULT_CUSTOM_THEME_FALLBACK;
      themeToApply = {
        ...baseCustomDefinition,
        ...customThemeColors,   
        name: 'custom',         
      };
    } else {
      themeToApply = themes.find((t) => t.name === currentThemeName) || themes.find((t) => t.name === 'paper');
    }

    if (themeToApply) {
      setTheme(themeToApply, config?.paperTexture ?? true);
    } else {
      console.warn(`Themes: No theme definition found for "${currentThemeName}". Applying fallback.`);
      setTheme(DEFAULT_CUSTOM_THEME_FALLBACK, config?.paperTexture ?? true);
    }
    if (config?.fontSize) {
      document.documentElement.style.setProperty('--global-font-size', `${config.fontSize}px`);
    }
  }, [config?.theme, customThemeColors, config?.paperTexture, config?.fontSize]);


  return (
    <AccordionItem
      value="themes"
      className={cn(
        "transition-all duration-150 ease-in-out",
        "hover:border-[var(--active)] hover:brightness-105"
      )}
    >
      <AccordionTrigger
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 hover:no-underline",
          "text-[var(--text)] font-medium",
          "hover:brightness-95",
        )}
      >
        <SettingTitle icon="🖌️" text="Customize" />
      </AccordionTrigger>
      <AccordionContent className="px-3 pb-4 pt-2 text-[var(--text)]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pr-3">
              <Label htmlFor="generateTitle-switch" className="text-base font-medium text-foreground cursor-pointer">Create chat title</Label>
              <Switch
                id="generateTitle-switch"
                checked={config?.generateTitle ?? false}
                onCheckedChange={(checked) => updateConfig({ generateTitle: checked })}
              />
            </div>
            <div className="flex items-center justify-between pr-3">
              <Label htmlFor="backgroundImage-switch" className="text-base font-medium text-foreground cursor-pointer">Background illustration</Label>
              <Switch
                id="backgroundImage-switch"
                checked={config?.backgroundImage ?? false}
                onCheckedChange={(checked) => updateConfig({ backgroundImage: checked })}
              />
            </div>
            <div className="flex items-center justify-between pr-3">
              <Label htmlFor="paperTexture-switch" className="text-base font-medium text-foreground cursor-pointer">Paper texture</Label>
              <Switch
                id="paperTexture-switch"
                checked={config?.paperTexture ?? true}
                onCheckedChange={(checked) => updateConfig({ paperTexture: checked })}
              />
            </div>
          </div>

          <div>
            <p className="text-foreground text-base font-medium pb-3 text-left">Font Size: {currentFontSize}px</p>
            <Slider value={[currentFontSize]} max={20} min={7} step={1} className="w-full" onValueChange={(value) => { updateConfig({ fontSize: value[0] }); }} />
          </div>

          <div className="pt-4 mt-4 border-t border-[var(--text)]/20">
            <div className="space-y-2 mb-4">
              <h4 className="font-medium leading-none text-foreground">Custom Theme Colors</h4>
              <p className="text-sm text-muted-foreground">Modify colors for your 'custom' theme. Selecting a color will automatically apply the custom theme.</p>
            </div>
            <div className="space-y-3">
              {editableColorKeys.map((key) => {
                const colorValue = effectiveCustomThemeForPickers[key];
                const normalizedColor = normalizeColor(colorValue);
                const isValid = isValidColor(colorValue);

                if (!isValid) {
                  console.error(`Themes UI: Invalid color value for key "${key}":`, colorValue);
                  return (
                    <div key={key} className="flex items-center justify-between p-2 text-red-500 bg-red-100 rounded-md">
                      <Label className="capitalize text-sm font-medium text-red-600">{key}</Label>
                      <span>Invalid color: "{String(colorValue)}"</span>
                    </div>
                  );
                }

                return (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="capitalize text-sm font-medium text-foreground">{key}</Label>
                    <Popover 
                      open={pickerVisibleForKey === key} 
                      onOpenChange={(isOpen) => setPickerVisibleForKey(isOpen ? key : null)}
                    >
                      <PopoverTrigger asChild>
                        <button 
                          className="w-20 h-8 border border-border rounded-sm cursor-pointer hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" 
                          style={{ backgroundColor: normalizedColor }} 
                          aria-label={`Pick color for ${key}: ${normalizedColor}`}
                        />
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-popover border border-border shadow-lg z-[51]" side="right" align="start" sideOffset={10} onOpenAutoFocus={(e) => e.preventDefault()} >
                        {pickerVisibleForKey === key && (
                          <PaletteColorPicker key={`${key}-${colorValue}`} initialColor={colorValue} onColorChangeComplete={handleColorChange} themeKey={key} />
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

// Update the color validation function
function isValidColor(color: string): boolean {
  if (!color) return false;
  
  // Remove any non-hex characters
  const hex = color.replace(/[^0-9a-f]/gi, '');
  
  // Check if the remaining hex digits are valid length
  return [6, 8].includes(hex.length);
}

// Update the normalize function
function normalizeColor(color: string): string {
  if (!color) return '#000000ff';

  // Remove non-hex characters
  let hex = color.replace(/[^0-9a-f]/gi, '');

  // Only keep the first 8 digits (RRGGBBAA)
  hex = hex.slice(0, 8);

  // Pad to 6 or 8 digits
  if (hex.length < 6) {
    hex = hex.padEnd(6, '0');
  }
  if (hex.length === 6) {
    hex += 'ff'; // opaque
  }

  // Only allow 8 digits (RRGGBBAA)
  hex = hex.slice(0, 8);

  return `#${hex}`;
}
import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/useAppTheme";

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export interface IconPickerProps {
  selectedIcon: IconName | string;
  onSelectIcon: (icon: IconName) => void;
  icons: IconName[];
  activeColor?: string;
  className?: string;
}

export function IconPicker({
  selectedIcon,
  onSelectIcon,
  icons,
  activeColor,
  className = "",
}: IconPickerProps) {
  const { colors } = useAppTheme();
  const themeActiveColor = activeColor || colors.primary[500];

  return (
    <View className={`flex-row flex-wrap gap-2.5 ${className}`}>
      {icons.map((iconName) => {
        const isSelected = selectedIcon === iconName;
        return (
          <Pressable
            key={iconName}
            onPress={() => onSelectIcon(iconName)}
            className={`w-11 h-11 rounded-2xl items-center justify-center active:opacity-80 ${
              isSelected ? "bg-primary-600/20" : "bg-surface-700"
            }`}
            style={
              isSelected && activeColor
                ? { backgroundColor: `${activeColor}25` }
                : undefined
            }
          >
            <MaterialCommunityIcons
              name={iconName}
              size={22}
              color={
                isSelected
                  ? themeActiveColor
                  : colors.text.secondary
              }
            />
          </Pressable>
        );
      })}
    </View>
  );
}


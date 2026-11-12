import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { accountColors } from "@/theme/palettes";

export interface ColorPickerProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
  colors?: string[];
  className?: string;
}

export function ColorPicker({
  selectedColor,
  onSelectColor,
  colors = accountColors,
  className = "",
}: ColorPickerProps) {
  return (
    <View className={`flex-row flex-wrap gap-3 ${className}`}>
      {colors.map((c) => {
        const isSelected = selectedColor.toLowerCase() === c.toLowerCase();
        return (
          <Pressable
            key={c}
            onPress={() => onSelectColor(c)}
            style={{ backgroundColor: c }}
            className={`w-10 h-10 rounded-2xl items-center justify-center shadow-sm active:opacity-80 ${
              isSelected ? "scale-110" : "opacity-85"
            }`}
          >
            {isSelected && (
              <MaterialCommunityIcons name="check" size={20} color="#ffffff" />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}


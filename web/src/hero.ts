import { heroui } from "@heroui/react";

export default heroui({
    themes: {
        light: {
            colors: {
                primary: {
                    DEFAULT: "#FF5722",
                    foreground: "#FFFFFF",
                    50: "#fff3f0",
                    100: "#ffe4dd",
                    200: "#ffbfb0",
                    300: "#ff9980",
                    400: "#ff7355",
                    500: "#FF5722",
                    600: "#e64a1a",
                    700: "#c43d14",
                    800: "#9c300f",
                    900: "#73230a",
                },
                success: {
                    DEFAULT: "#22C55E",
                    foreground: "#FFFFFF",
                },
                danger: {
                    DEFAULT: "#EF4444",
                    foreground: "#FFFFFF",
                },
                warning: {
                    DEFAULT: "#F59E0B",
                    foreground: "#FFFFFF",
                },
            },
        },
        dark: {
            colors: {
                primary: {
                    DEFAULT: "#FF5722",
                    foreground: "#FFFFFF",
                    50: "#2a1000",
                    100: "#3d1800",
                    200: "#5c2400",
                    300: "#803400",
                    400: "#b34800",
                    500: "#FF5722",
                    600: "#ff7044",
                    700: "#ff8c6a",
                    800: "#ffa991",
                    900: "#ffc6b8",
                },
                success: {
                    DEFAULT: "#22C55E",
                    foreground: "#FFFFFF",
                },
                danger: {
                    DEFAULT: "#EF4444",
                    foreground: "#FFFFFF",
                },
            },
        },
    },
});

import { useEffect, useState } from "react"

const themes = {
    zinc: {
        primary: "240 5.9% 10%",
        active: "240 5.9% 10%",
        ring: "240 10% 3.9%",
    },
    violet: {
        primary: "262.1 83.3% 57.8%",
        active: "262.1 83.3% 57.8%",
        ring: "262.1 83.3% 57.8%",
    },
    emerald: {
        primary: "142.1 76.2% 36.3%",
        active: "142.1 76.2% 36.3%",
        ring: "142.1 76.2% 36.3%",
    },
    rose: {
        primary: "346.8 77.2% 49.8%",
        active: "346.8 77.2% 49.8%",
        ring: "346.8 77.2% 49.8%",
    },
    amber: {
        primary: "47.9 95.8% 53.1%",
        active: "47.9 95.8% 53.1%",
        ring: "47.9 95.8% 53.1%",
    },
}

export function useTheme() {
    const [theme, setTheme] = useState("zinc")
    const [mode, setMode] = useState("dark") // Default to dark for premium feel

    useEffect(() => {
        const root = window.document.documentElement

        // Set Mode
        root.classList.remove("light", "dark")
        root.classList.add(mode)

        // Set Color Theme
        const color = themes[theme] || themes.zinc
        root.style.setProperty("--primary", color.primary)
        root.style.setProperty("--ring", color.ring)
        // We can also set --primary-foreground if needed, but white usually works for these dark colors

    }, [theme, mode])

    return { theme, setTheme, mode, setMode, themes }
}

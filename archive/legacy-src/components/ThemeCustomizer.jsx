import React from "react"
import { Moon, Sun, Palette, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useTheme } from "@/hooks/use-theme"
import { cn } from "@/lib/utils"

export function ThemeCustomizer() {
    const { theme, setTheme, mode, setMode, themes } = useTheme()

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                    <Palette className="h-[1.2rem] w-[1.2rem]" />
                    <span className="sr-only">Customize Theme</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="end">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Theme Color</h4>
                        <p className="text-sm text-muted-foreground">
                            Select the primary color for your dashboard.
                        </p>
                        <div className="grid grid-cols-5 gap-2">
                            {Object.keys(themes).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTheme(t)}
                                    className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs",
                                        theme === t
                                            ? "border-primary"
                                            : "border-transparent"
                                    )}
                                    style={{
                                        backgroundColor: `hsl(${themes[t].primary})`,
                                    }}
                                >
                                    {theme === t && <Check className="h-4 w-4 text-white" />}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Mode</h4>
                        <div className="flex gap-2">
                            <Button
                                variant={mode === "light" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setMode("light")}
                                className="flex-1"
                            >
                                <Sun className="mr-2 h-4 w-4" /> Light
                            </Button>
                            <Button
                                variant={mode === "dark" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setMode("dark")}
                                className="flex-1"
                            >
                                <Moon className="mr-2 h-4 w-4" /> Dark
                            </Button>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

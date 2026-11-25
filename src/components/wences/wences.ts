// Wences MK2: data saved by the printer's own macros (repo wencescarlos/wences-mk2-macros).
// Shared by the "Printer health" dashboard panel and the topbar alerts. Mainsail already
// subscribes to every Klipper object, so everything comes from rootState.printer.

import { PrinterState } from '@/store/printer/types'

export interface WencesMaintenance {
    hours: number
    filamentMeters: number
    due: string[]
    next: { task: string; hoursLeft: number } | null
}

export interface WencesSonarStatus {
    started?: number | null
    losses?: number
    last_loss?: number | null
    last_reconnect?: number | null
    events?: { lost: number; reconnected: number; attempts: number }[]
}

export function getSaveVariables(printer: PrinterState): PrinterState {
    return printer?.save_variables?.variables ?? {}
}

export function getMaintenance(printer: PrinterState): WencesMaintenance {
    const mant = getSaveVariables(printer).mant ?? {}
    const hours = Number(mant.horas ?? 0)
    const done: Record<string, number> = mant.hecho ?? {}
    const tasks: Record<string, [string, number]> = printer?.['gcode_macro _MANT']?.tareas ?? {}
    const due: string[] = []
    let next: WencesMaintenance['next'] = null

    Object.entries(tasks).forEach(([key, [task, every]]) => {
        const hoursLeft = Number(every) - (hours - Number(done[key] ?? 0))
        if (hoursLeft <= 0) {
            due.push(task)
            return
        }
        if (next === null || hoursLeft < next.hoursLeft) next = { task, hoursLeft }
    })

    return { hours, filamentMeters: Number(mant.filamento_m ?? 0), due, next }
}

// Alerts for the topbar: an interrupted print that can be recovered and due maintenance
export function getAlerts(printer: PrinterState): { recover: boolean; maintenance: string[] } {
    return {
        // 'plr' is saved on every layer while printing, so it only means "interrupted" when idle
        recover:
            !!getSaveVariables(printer).plr &&
            !['printing', 'paused'].includes(printer?.print_stats?.state ?? ''),
        maintenance: getMaintenance(printer).due,
    }
}

export function getSheet(printer: PrinterState): { name: string; offset: number } {
    const surfaces = getSaveVariables(printer).bed_surfaces ?? {}
    const name = surfaces.active ?? 'default'
    return { name, offset: Number(surfaces.available?.[name]?.offset ?? 0) }
}

export function hasWencesMacros(printer: PrinterState): boolean {
    return !!printer?.['gcode_macro _MANT']
}

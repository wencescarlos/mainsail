<template>
    <panel
        v-if="showPanel"
        :icon="mdiHeartPulse"
        :title="$t('Panels.PrinterHealthPanel.Headline')"
        :collapsible="true"
        card-class="printer-health-panel">
        <template #buttons>
            <v-btn icon tile :to="'/calibracion'" :title="$t('Panels.PrinterHealthPanel.OpenCalibration')">
                <v-icon>{{ mdiTune }}</v-icon>
            </v-btn>
        </template>
        <v-simple-table dense class="printer-health-table">
            <tbody>
                <template v-for="section in sections">
                    <tr :key="'h-' + section.title">
                        <th colspan="2" class="text-subtitle-2 pt-3">{{ section.title }}</th>
                    </tr>
                    <tr v-for="(row, index) in section.rows" :key="section.title + '-' + index">
                        <td class="text--secondary">{{ row.label }}</td>
                        <td class="text-right" :class="row.color ? row.color + '--text font-weight-bold' : ''">
                            {{ row.value }}
                        </td>
                    </tr>
                </template>
            </tbody>
        </v-simple-table>
    </panel>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import { PrinterState } from '@/store/printer/types'
import { mdiHeartPulse, mdiTune } from '@mdi/js'
import {
    getMaintenance,
    getSaveVariables,
    getSheet,
    hasWencesMacros,
    WencesSonarStatus,
} from '@/components/wences/wences'

interface HealthRow {
    label: string
    value: string
    color?: string
}

interface HealthSection {
    title: string
    rows: HealthRow[]
}

const SONAR_REFRESH_MS = 5 * 60 * 1000

// Summary of what the Wences MK2 macros measure and save (maintenance, Z axis and sheet,
// mechanics, filaments) plus the WiFi losses recorded by Sonar (fork wencescarlos/sonar).
@Component({
    components: { Panel },
})
export default class PrinterHealthPanel extends Mixins(BaseMixin) {
    mdiHeartPulse = mdiHeartPulse
    mdiTune = mdiTune

    sonar: WencesSonarStatus | null = null
    sonarTimer: number | null = null

    get printer(): PrinterState {
        return this.$store.state.printer ?? {}
    }

    get showPanel(): boolean {
        return hasWencesMacros(this.printer)
    }

    get sections(): HealthSection[] {
        return [
            this.maintenanceSection,
            this.zAxisSection,
            this.mechanicsSection,
            this.filamentSection,
            this.wifiSection,
        ].filter((section) => section.rows.length > 0)
    }

    get maintenanceSection(): HealthSection {
        const m = getMaintenance(this.printer)
        const rows: HealthRow[] = [
            { label: this.t('Hours'), value: `${this.num(m.hours, 1)} h` },
            { label: this.t('Filament'), value: `${this.num(m.filamentMeters, 0)} m` },
        ]
        m.due.forEach((task) => rows.push({ label: this.t('Due'), value: task, color: 'warning' }))
        if (!m.due.length && m.next) {
            rows.push({
                label: this.t('Next'),
                value: `${m.next.task} (${this.t('InHours', { hours: this.num(m.next.hoursLeft, 0) })})`,
            })
        }
        return { title: this.t('Maintenance'), rows }
    }

    get zAxisSection(): HealthSection {
        const sv = getSaveVariables(this.printer)
        const settings = this.printer.configfile?.settings ?? {}
        const sheet = getSheet(this.printer)
        const rows: HealthRow[] = [
            { label: this.t('ZOffset'), value: `${this.num(settings.probe?.z_offset, 3)} mm` },
            { label: this.t('Sheet'), value: `${sheet.name} (${this.num(sheet.offset, 3, true)} mm)` },
        ]
        const height = sv.altura_z_medida
        const positionMax = settings.stepper_z?.position_max
        if (height != null && positionMax != null) {
            rows.push({
                label: this.t('RealHeight'),
                value: `${this.num(height, 2)} / ${this.num(positionMax, 1)} mm`,
                color: height - positionMax < 0.5 ? 'warning' : undefined,
            })
        }
        if (sv.tuercas_pom_topes != null) {
            const side = sv.tuercas_pom_topes < 0 ? this.t('RightHigher') : this.t('LeftHigher')
            rows.push({ label: this.t('TopStops'), value: `${this.num(sv.tuercas_pom_topes, 2, true)} mm (${side})` })
        }
        if (sv.tuercas_z_izq_max != null) {
            const worst = Math.max(sv.tuercas_z_izq_max ?? 0, sv.tuercas_z_der_max ?? 0)
            rows.push({
                label: this.t('ZNuts'),
                value: `${this.num(sv.tuercas_z_izq_max, 2)} / ${this.num(sv.tuercas_z_der_max, 2)} mm`,
                color: worst > 0.1 ? 'warning' : undefined,
            })
        }
        return { title: this.t('ZAxis'), rows }
    }

    get mechanicsSection(): HealthSection {
        const settings = this.printer.configfile?.settings ?? {}
        const rows: HealthRow[] = []
        const skew = settings['skew_correction pinda_skew']?.xy_skew
        if (skew != null) {
            const degrees = (Math.atan(skew) * 180) / Math.PI
            rows.push({
                label: this.t('Skew'),
                value: `${this.num(degrees, 3, true)}° (${this.num(Math.abs(skew) * 200, 2)} mm / 200 mm)`,
            })
        }
        const sgX = settings['tmc2209 stepper_x']?.driver_sgthrs
        const sgY = settings['tmc2209 stepper_y']?.driver_sgthrs
        if (sgX != null) rows.push({ label: this.t('Sensorless'), value: `${sgX} / ${sgY}` })
        const zones = Object.keys(settings.bed_mesh ?? {}).filter(
            (key) => key.startsWith('faulty_region') && key.endsWith('_min')
        ).length
        rows.push({ label: this.t('Magnets'), value: this.t('MagnetZones', { count: zones }) })
        return { title: this.t('Mechanics'), rows }
    }

    get filamentSection(): HealthSection {
        const sv = getSaveVariables(this.printer)
        const macro = this.printer['gcode_macro _FILAMENTOS'] ?? {}
        const rows = Object.keys(macro.tipos ?? {}).map((type) => {
            const saved = sv[`pa_${type.toLowerCase()}`]
            const value = saved ?? macro.pa?.[type]
            return {
                label: type,
                value: `PA ${this.num(value, 3)}${saved == null ? ` (${this.t('Uncalibrated')})` : ''}`,
                color: saved == null ? 'grey' : undefined,
            }
        })
        return { title: this.t('Filaments'), rows }
    }

    get wifiSection(): HealthSection {
        if (!this.sonar) return { title: this.t('Wifi'), rows: [] }
        const rows: HealthRow[] = []
        if (this.sonar.started) rows.push({ label: this.t('WifiSince'), value: this.date(this.sonar.started) })
        const losses = Number(this.sonar.losses ?? 0)
        rows.push({ label: this.t('Losses'), value: losses ? `${losses}` : this.t('NoLosses') })
        if (this.sonar.last_loss) {
            const last = this.sonar.events?.at(-1)
            const how = last
                ? last.attempts
                    ? this.t('Restarts', { count: last.attempts })
                    : this.t('RecoveredAlone')
                : ''
            rows.push({
                label: this.t('LastLoss'),
                value: `${this.date(this.sonar.last_loss)}${how ? ` (${how})` : ''}`,
                color: Date.now() / 1000 - this.sonar.last_loss < 86400 ? 'warning' : undefined,
            })
        }
        return { title: this.t('Wifi'), rows }
    }

    mounted() {
        this.loadSonar()
        this.sonarTimer = window.setInterval(this.loadSonar, SONAR_REFRESH_MS)
    }

    beforeDestroy() {
        if (this.sonarTimer !== null) window.clearInterval(this.sonarTimer)
    }

    async loadSonar() {
        try {
            const response = await fetch(`${this.apiUrl}/server/files/logs/sonar_estado.json`, { cache: 'no-store' })
            this.sonar = response.ok ? await response.json() : null
        } catch {
            this.sonar = null
        }
    }

    t(key: string, values?: Record<string, unknown>): string {
        return this.$t(`Panels.PrinterHealthPanel.${key}`, values).toString()
    }

    num(value: unknown, decimals: number, sign = false): string {
        const n = Number(value)
        if (value == null || Number.isNaN(n)) return '—'
        const text = n.toLocaleString(this.$i18n.locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        })
        return sign && n > 0 ? `+${text}` : text
    }

    date(seconds: number): string {
        return new Date(seconds * 1000).toLocaleString(this.$i18n.locale, {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        })
    }
}
</script>

<style scoped>
.printer-health-table th,
.printer-health-table td {
    border-bottom: none !important;
}
</style>

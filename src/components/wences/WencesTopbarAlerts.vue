<template>
    <div class="d-flex align-center">
        <v-tooltip v-if="alerts.recover" bottom>
            <template #activator="{ on, attrs }">
                <v-btn tile text color="error" class="px-3" v-bind="attrs" v-on="on" @click="recover">
                    <v-icon class="mr-md-2">{{ mdiBackupRestore }}</v-icon>
                    <span class="d-none d-md-inline">{{ $t('App.TopBar.WencesRecover') }}</span>
                </v-btn>
            </template>
            <span>{{ $t('App.TopBar.WencesRecoverHint') }}</span>
        </v-tooltip>
        <v-tooltip v-if="alerts.maintenance.length" bottom>
            <template #activator="{ on, attrs }">
                <v-btn tile text color="warning" class="px-3" to="/calibracion#mant" v-bind="attrs" v-on="on">
                    <v-icon class="mr-md-2">{{ mdiWrenchClock }}</v-icon>
                    <span class="d-none d-md-inline">{{ $t('App.TopBar.WencesMaintenance') }}</span>
                </v-btn>
            </template>
            <span>{{ alerts.maintenance.join(' · ') }}</span>
        </v-tooltip>
    </div>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { mdiBackupRestore, mdiWrenchClock } from '@mdi/js'
import { getAlerts } from '@/components/wences/wences'

// Topbar alerts of the Wences MK2 macros: interrupted print to recover (variable plr) and due
// maintenance (macro _MANT). RECUPERAR_IMPRESION asks for confirmation before doing anything.
@Component
export default class WencesTopbarAlerts extends Mixins(BaseMixin) {
    mdiBackupRestore = mdiBackupRestore
    mdiWrenchClock = mdiWrenchClock

    get alerts() {
        return getAlerts(this.$store.state.printer ?? {})
    }

    recover() {
        this.$store.dispatch('server/addEvent', { message: 'RECUPERAR_IMPRESION', type: 'command' })
        this.$socket.emit('printer.gcode.script', { script: 'RECUPERAR_IMPRESION' })
    }
}
</script>

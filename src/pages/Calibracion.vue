<template>
    <iframe :src="src" :title="$t('Router.Calibration')" class="wences-calibration" :style="frameStyle" />
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { topbarHeight } from '@/store/variables'

// Calibration pages of the Wences MK2 (bed, magnets, XY skew, input shaper, motors, filaments,
// maintenance). They are static pages published in ~/mainsail/wences by restaurar_extras.sh
// from the wences-mk2-macros repo; the route hash selects a tab (/calibracion#imanes).
@Component
export default class PageCalibracion extends Mixins(BaseMixin) {
    get src(): string {
        return `/wences/${this.$route.hash ?? ''}`
    }

    get frameStyle(): Record<string, string> {
        return { height: `calc(100vh - ${topbarHeight}px - 24px)` }
    }
}
</script>

<style scoped>
.wences-calibration {
    width: 100%;
    border: 0;
    display: block;
}
</style>

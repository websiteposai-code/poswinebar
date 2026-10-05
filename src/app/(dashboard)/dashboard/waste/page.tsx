import { getWasteReport, getWasteFormOptions, getOpenedWineBottles } from "@/actions/waste"
import WasteClient from "./waste-client"

export const dynamic = "force-dynamic"

export default async function WastePage() {
    const [report, formOptions, openedBottles] = await Promise.all([
        getWasteReport(),
        getWasteFormOptions(),
        getOpenedWineBottles(),
    ])
    return <WasteClient initial={report} formOptions={formOptions} openedBottles={openedBottles} />
}


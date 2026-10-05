import { getRecipes } from "@/actions/assets"
import { getProducts } from "@/actions/menu"
import { getRawMaterials } from "@/actions/assets"
import { getCostTargetConfig } from "@/actions/cost-config"
import RecipesClient from "./recipes-client"

export const dynamic = "force-dynamic"

export default async function RecipesPage() {
    const [recipes, products, materials, costConfig] = await Promise.all([
        getRecipes(),
        getProducts(),
        getRawMaterials(),
        getCostTargetConfig(),
    ])
    return (
        <RecipesClient
            initialRecipes={recipes}
            initialProducts={products}
            initialMaterials={materials}
            initialCostConfig={costConfig}
        />
    )
}


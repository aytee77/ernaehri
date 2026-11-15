import { NextResponse } from "next/server";
import { getBettyBossiRecipe } from "@/lib/bettybossi/recipe";
import { listBettyBossiRefs } from "@/lib/bettybossi/sitemap";
import { bringDefaultListName, isBringConfigured, listBringLists, matchDefaultList } from "@/lib/bring/client";
import { getFoobyRecipe } from "@/lib/fooby/recipe";
import { listFoobyRefs } from "@/lib/fooby/sitemap";
import { listRecipesByTaxonomy } from "@/lib/migusto/catalog";
import { getRecipe as getMigustoRecipe } from "@/lib/migusto/recipe";
import { flattenIngredients } from "@/lib/migusto/recipe-parse";
import { getProducts, migrosApiBase, migrosApiKey } from "@/lib/migros/client";
import { matchIngredients } from "@/lib/migros/match";
import { findProductForIngredient } from "@/lib/migros/search";
import type { Recipe, RecipeRef, RecipeSource } from "@/lib/recipes/types";
import { listMainDishRefs } from "@/lib/recipes/registry";

/**
 * Diagnostics endpoint: verifies that the Migusto catalogue, the recipe parsers
 * (Migusto, Betty Bossi, FOOBY) and the Migros product/price API all work from
 * this machine.
 *
 * GET /api/diag            → default probe (Migusto: Ungarisches Gulasch)
 * GET /api/diag?id=&slug=  → probe another Migusto recipe
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "22774";
  const slug = url.searchParams.get("slug") ?? "ungarisches-gulasch";
  const problems: Array<{ step: string; message: string }> = [];
  const failure = (step: string, error: unknown) => ({
    step,
    message: error instanceof Error ? error.message : String(error),
  });

  const report: Record<string, unknown> = {
    migros: { base: migrosApiBase(), keyConfigured: migrosApiKey().length > 0 },
    problems,
  };

  try {
    const refs = await listRecipesByTaxonomy("hauptgericht", 1);
    report.catalog = {
      count: refs.length,
      sample: refs.slice(0, 5).map((ref) => `${ref.id} ${ref.title}`),
    };
  } catch (error) {
    problems.push(failure("catalog", error));
  }

  let productIds: string[] = [];

  try {
    const recipe = await getMigustoRecipe(id, slug);
    productIds = recipe.productIds;
    const baseSize = recipe.sizes.find((size) => size.isDefault) ?? recipe.sizes[0];
    report.recipe = {
      id: recipe.id,
      title: recipe.title,
      totalTime: recipe.totalTimeText,
      rating: recipe.rating,
      servings: recipe.defaultServings,
      sizeOptions: recipe.sizeOptions,
      sizes: recipe.sizes.map((size) => size.textFull),
      image: recipe.image,
      steps: recipe.steps.length,
      ingredients: flattenIngredients(baseSize).map((ingredient) => ({
        name: ingredient.name,
        amount: `${ingredient.amount?.quantity ?? ""} ${ingredient.amount?.unit ?? ""}`.trim(),
        shoppingRelevant: ingredient.isShoppingListRelevant,
      })),
    };
  } catch (error) {
    problems.push(failure("recipe", error));
  }

  try {
    const lookup = await getProducts(productIds);
    report.products = {
      requested: productIds.length,
      source: lookup.source,
      notice: lookup.notice,
      missing: lookup.missingIds,
      list: lookup.products.slice(0, 6).map((product) => ({
        uid: product.uid,
        name: product.name,
        price: product.priceChf,
        category: product.leafCategory,
      })),
    };

    const recipe = report.recipe as { ingredients?: Array<{ name: string; shoppingRelevant: boolean }> } | undefined;
    if (recipe?.ingredients) {
      const asIngredients = recipe.ingredients
        .filter((entry) => entry.shoppingRelevant)
        .map((entry, index) => ({
          key: `probe:${index}`,
          name: entry.name,
          singular: entry.name,
          plural: entry.name,
          ingredientId: null,
          amount: null,
          isMain: false,
          isShoppingListRelevant: true,
          cultivar: null,
        }));
      report.matches = matchIngredients(asIngredients, lookup.products).map((match) => ({
        ingredient: match.ingredient.name,
        product: match.product?.name ?? null,
        price: match.product?.priceChf ?? null,
        score: Number(match.score.toFixed(2)),
      }));
    }
  } catch (error) {
    problems.push(failure("products", error));
  }

  await probeBring(report, problems);
  await probeSource("bettybossi", report, problems, listBettyBossiRefs, getBettyBossiRecipe);
  await probeSource("fooby", report, problems, listFoobyRefs, getFoobyRecipe);

  return NextResponse.json(report, { status: 200 });
}

/**
 * Reports whether the Bring! export is configured and whether the account (and its
 * lists) can be reached. Credentials themselves are never part of the report.
 */
async function probeBring(
  report: Record<string, unknown>,
  problems: Array<{ step: string; message: string }>,
): Promise<void> {
  const configured = isBringConfigured();
  report.bring = { configured, listName: bringDefaultListName() };

  if (!configured) {
    return;
  }

  try {
    const lists = await listBringLists();
    report.bring = {
      ...(report.bring as Record<string, unknown>),
      lists: lists.map((list) => list.name),
      defaultListUuid: matchDefaultList(lists),
    };
  } catch (error) {
    problems.push({
      step: "bring",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Probes a sitemap-driven source: lists the catalogue, loads a recipe and checks
 * that its (text) ingredients can still be matched to Migros products.
 */
async function probeSource(
  key: RecipeSource,
  report: Record<string, unknown>,
  problems: Array<{ step: string; message: string }>,
  listRefs: () => Promise<RecipeRef[]>,
  loadRecipe: (id: string, slug: string) => Promise<Recipe>,
): Promise<void> {
  let refs: RecipeRef[];
  try {
    refs = await listRefs();
    report[key] = {
      catalogCount: refs.length,
      sample: refs.slice(0, 3).map((ref) => `${ref.id} ${ref.slug}`),
    };
  } catch (error) {
    problems.push({
      step: `${key}.catalog`,
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  try {
    const mains = await listMainDishRefs(key);
    report[key] = {
      ...(report[key] as Record<string, unknown>),
      mainDishCount: mains.length,
      mainDishSample: mains.slice(0, 10).map((ref) => ref.title),
    };
  } catch (error) {
    problems.push({
      step: `${key}.mainDishes`,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const ref = refs[0];
  if (!ref) {
    return;
  }

  try {
    const recipe = await loadRecipe(ref.id, ref.slug);
    const size = recipe.sizes.find((entry) => entry.isDefault) ?? recipe.sizes[0];
    const ingredients = size
      ? flattenIngredients(size).map((ingredient) => ({
          name: ingredient.name,
          amount: `${ingredient.amount?.quantity ?? ""} ${ingredient.amount?.unit ?? ""}`.trim(),
        }))
      : [];

    const migrosMatches: Array<{ ingredient: string; product: string | null; price: number | null }> = [];
    for (const ingredient of ingredients.slice(0, 3)) {
      const product = await findProductForIngredient(ingredient.name).catch(() => null);
      migrosMatches.push({
        ingredient: ingredient.name,
        product: product?.name ?? null,
        price: product?.priceChf ?? null,
      });
    }

    report[key] = {
      ...(report[key] as Record<string, unknown>),
      recipe: {
        id: recipe.id,
        title: recipe.title,
        servings: recipe.defaultServings,
        totalTime: recipe.totalTimeText,
        steps: recipe.steps.length,
        ingredients: ingredients.slice(0, 12),
      },
      migrosMatches,
    };
  } catch (error) {
    problems.push({
      step: `${key}.recipe`,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

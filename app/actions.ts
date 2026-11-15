"use server";

import { getRecipe } from "@/lib/recipes/registry";
import { generatePlan, removeMealFromPlan, swapMealInPlan } from "@/lib/planner/planner";
import { isWeekday, sanitizeInput, sanitizePlan, toError, type ActionResult } from "@/lib/planner/validate";
import {
  addBringItems,
  bringDefaultListName,
  createBringList,
  isBringConfigured,
  listBringItemNames,
  listBringLists,
  matchDefaultList,
} from "@/lib/bring/client";
import type { BringExportSummary, BringStatus } from "@/lib/bring/types";
import { sanitizeBringExport } from "@/lib/bring/validate";
import { costMeals } from "@/lib/shopping/list";
import type { ShoppingList } from "@/lib/shopping/types";
import type { MealPlan, Weekday } from "@/lib/planner/types";

/** List created on demand when `BRING_LIST_NAME` is not configured at all. */
const DEFAULT_BRING_LIST_NAME = "Ernähri";

/** Wizard step 4: build a week of meals plus its costs. */
export async function generateWeekAction(rawInput: unknown): Promise<ActionResult<MealPlan>> {
  try {
    const input = sanitizeInput(rawInput);
    const plan = await generatePlan({ input, nonce: Math.random().toString(36) });
    return { ok: true, data: plan };
  } catch (error) {
    return { ok: false, error: toError(error) };
  }
}

/** "Remove meal": drops one day and re-costs the week. */
export async function removeMealAction(rawPlan: unknown, day: Weekday): Promise<ActionResult<MealPlan>> {
  try {
    if (!isWeekday(day)) throw new Error("UngÃ¼ltiger Wochentag.");
    const plan = await removeMealFromPlan(sanitizePlan(rawPlan), day);
    return { ok: true, data: plan };
  } catch (error) {
    return { ok: false, error: toError(error) };
  }
}

/** "Another recipe": replaces a single meal. */
export async function swapMealAction(rawPlan: unknown, day: Weekday): Promise<ActionResult<MealPlan>> {
  try {
    if (!isWeekday(day)) throw new Error("UngÃ¼ltiger Wochentag.");
    const plan = await swapMealInPlan(sanitizePlan(rawPlan), day);
    return { ok: true, data: plan };
  } catch (error) {
    return { ok: false, error: toError(error) };
  }
}

/** "New week": keeps the settings, produces a different week. */
export async function regenerateWeekAction(rawPlan: unknown): Promise<ActionResult<MealPlan>> {
  try {
    const plan = sanitizePlan(rawPlan);
    const next = await generatePlan({
      input: plan.input,
      excludeIds: plan.usedRecipeIds,
      nonce: Math.random().toString(36),
    });
    return { ok: true, data: next };
  } catch (error) {
    return { ok: false, error: toError(error) };
  }
}

/** Rebuilds the shopping list (and its Migros prices) for the current plan. */
export async function shoppingListAction(rawPlan: unknown): Promise<ActionResult<ShoppingList>> {
  try {
    const plan = sanitizePlan(rawPlan);
    const recipes = await Promise.all(
      plan.meals.map((meal) =>
        getRecipe({ source: meal.source, id: meal.recipeId, slug: meal.slug, title: meal.title }, "de"),
      ),
    );
    const costing = await costMeals(
      recipes.map((recipe, index) => ({ recipe, day: plan.meals[index].day, title: recipe.title })),
      plan.input.people,
      plan.input.budgetChf,
      "de",
    );
    return { ok: true, data: costing.shoppingList };
  } catch (error) {
    return { ok: false, error: toError(error) };
  }
}

/**
 * Bring! connection status for the shopping list panel: is the account configured
 * and which lists can be pushed to? Credentials never leave the server.
 */
export async function bringStatusAction(): Promise<ActionResult<BringStatus>> {
  if (!isBringConfigured()) {
    return {
      ok: true,
      data: { configured: false, lists: [], defaultListUuid: null, createListName: null, notice: null },
    };
  }

  try {
    const lists = await listBringLists();
    const defaultListUuid = matchDefaultList(lists);
    const wanted = bringDefaultListName();

    return {
      ok: true,
      data: {
        configured: true,
        lists,
        defaultListUuid,
        // Without BRING_LIST_NAME (or when that list is gone) the export creates one.
        createListName: defaultListUuid ? null : (wanted ?? DEFAULT_BRING_LIST_NAME),
        notice: null,
      },
    };
  } catch (error) {
    // A failed login must not break the panel – the user sees the reason as a notice.
    return {
      ok: true,
      data: { configured: true, lists: [], defaultListUuid: null, createListName: null, notice: toError(error) },
    };
  }
}

/**
 * "Nach Bring! senden": pushes the shopping list positions (label + amount) to a
 * Bring! list, skipping names that are already on it.
 */
export async function exportToBringAction(rawRequest: unknown): Promise<ActionResult<BringExportSummary>> {
  try {
    const request = sanitizeBringExport(rawRequest);
    const lists = await listBringLists();

    let target = request.listUuid
      ? lists.find((list) => list.listUuid === request.listUuid)
      : undefined;

    if (request.listUuid && !target) {
      throw new Error("Bring!-Liste nicht gefunden – Liste neu laden und erneut senden.");
    }

    if (!target) {
      const name = bringDefaultListName() ?? DEFAULT_BRING_LIST_NAME;
      target =
        lists.find((list) => list.name.trim().toLowerCase() === name.toLowerCase()) ??
        (await createBringList(name));
    }

    const existing = await listBringItemNames(target.listUuid);
    const { added, skipped } = await addBringItems(target.listUuid, request.items, existing);

    return { ok: true, data: { listName: target.name, added, skipped } };
  } catch (error) {
    return { ok: false, error: toError(error) };
  }
}


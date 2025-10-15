import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, ScrollView, View, Text, TouchableOpacity, TextInput, Alert, Image, Animated, Keyboard, FlatList } from 'react-native';
// For collapsible portion options
import { TouchableOpacity as RNTouchableOpacity } from "react-native";
import { Picker } from '@react-native-picker/picker';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import Constants from 'expo-constants';
import colors from '../../constants/colors';
import Card from '../../components/Card';
import PrimaryButton from '../../components/PrimaryButton';
import Chip from '../../components/Chip';
import GlucoseCurve from '../../components/GlucoseCurve';
import { mockSuggestions } from '../../lib/mock';
import Ionicons from '@expo/vector-icons/Ionicons';
import { debounce } from 'lodash';
import { decode as atob } from 'base-64';
import { useRouter } from 'expo-router';
// USDA API key (hardcoded for now)
const USDA_API_KEY = "kLTQw0oEFyckFvtRaozS0Em8ZR7J6mQq6fpef12F";
// In-memory cache for USDA responses
const foodCache = new Map<string, any>();

/**
 * Normalize a food name for USDA compatibility:
 * - Lowercase
 * - Remove punctuation
 * - Remove extra spaces
 * - Replace simple plurals (ending in 's') with singular
 */
function normalizeUSDAName(name: string): string {
  if (!name) return '';
  let cleaned = name.toLowerCase();
  // Remove punctuation (except commas, which are used in USDA names)
  cleaned = cleaned.replace(/[!?.;:"'’‘”“(){}\[\]\/\\\-]/g, '');
  // Replace multiple spaces with single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.trim();
  // Remove trailing plural 's' for each word (basic plural handling)
  cleaned = cleaned
    .split(' ')
    .map(w => w.endsWith('s') && w.length > 3 ? w.slice(0, -1) : w)
    .join(' ');
  // Remove trailing commas/spaces
  cleaned = cleaned.replace(/,\s*$/, '');
  return cleaned;
}

/**
 * Fetch macro nutrition data for a given ingredient using the USDA FoodData Central API.
 * Tries various normalized and variant queries for best match, with dataType fallback order:
 * 1. If dataType is provided, use it first.
 * 2. Fallback order: FNDDS (default), SR Legacy, Foundation.
 * 3. Finally, a catch-all search across all datasets.
 * Returns an object: { calories, protein, carbs, fat, fiber, sugar }
 * If not found, returns null.
 * @param ingredientName The ingredient name to search for.
 * @param dataType (optional) The USDA dataType string (e.g. "Foundation", "SR Legacy", "FNDDS", etc.)
 */
async function fetchFoodData(
  ingredientName: string,
  dataType?: string,
  customFallbackOrder?: (string | undefined)[]
): Promise<{
  calories: number | null,
  protein: number | null,
  carbs: number | null,
  fat: number | null,
  fiber: number | null,
  sugar: number | null,
  servingSize?: number,
  servingSizeUnit?: string,
  usdaDescription?: string,
  usdaDataType?: string,
  topResults?: Array<{ description: string; fdcId: number; dataType: string }>,
} | { topResults: Array<{ description: string; fdcId: number; dataType: string }> } | null> {
  const cacheKey = `${ingredientName.toLowerCase()}_${dataType || 'all'}`;
  if (foodCache.has(cacheKey)) {
    console.log(`⚡ Using cached macros for ${ingredientName}`);
    return foodCache.get(cacheKey);
  }
  // Try the following strategies:
  // 1. Normalized name
  // 2. Normalized name + ', cooked'
  // 3. Normalized name + ', raw'
  // 4. Original name (as fallback)
  try {
    let triedNames: string[] = [];
    let norm = normalizeUSDAName(ingredientName);
    let queries = [norm, norm + ', cooked', norm + ', raw'];
    // Add the original as a last resort if not already in list
    if (!queries.includes(ingredientName.trim().toLowerCase())) {
      queries.push(ingredientName.trim());
    }

    // Allow custom fallback order if provided
    let fallbackOrder: (string | undefined)[];
    if (customFallbackOrder && Array.isArray(customFallbackOrder) && customFallbackOrder.length > 0) {
      fallbackOrder = customFallbackOrder;
    } else {
      fallbackOrder = [
        "Survey (FNDDS)",
        "Foundation",
        "Branded",
        "SR Legacy",
        undefined
      ];
    }

    outer:
    for (const q of queries) {
      console.log(`🔍 Starting search for "${q}"...`);
      triedNames.push(q);
      for (const dt of fallbackOrder) {
        console.log(`   → Trying dataset: ${dt || 'All'} for query: "${q}"`);
        let dataTypeParam = "";
        if (dt) {
          dataTypeParam = `&dataType=${encodeURIComponent(dt)}`;
        } else {
          // Catch-all: omit dataType param entirely for full search
          dataTypeParam = "";
        }
        // First attempt: fetch with original query
        let searchResp = await fetch(
          `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(q)}${dataTypeParam}&pageSize=10`
        );
        if (!searchResp.ok) continue;
        let searchJson = await searchResp.json();
        let foods = searchJson.foods || [];
        if (foods.length === 0) {
          // No results; skip retrying with commas removed.
        } else {
          console.log(`   ↳ Received ${foods.length} results for "${q}" in dataset ${dt || 'All'}`);
        }
        let food = null;
        // Improved food selection logic with additionalDescriptions
        if (foods.length > 0) {
          const normalizedQuery = normalizeUSDAName(q);
          // Updated branded match logic
          food = foods.find((f: any) => {
            const desc = f.description?.toLowerCase() || "";
            const addl = f.additionalDescriptions?.toLowerCase() || "";
            const query = normalizedQuery.toLowerCase();
            return (
              desc.includes(query) ||
              query.includes(desc) ||
              addl.includes(query) ||
              query.includes(addl)
            );
          });

          // If no exact match, check partial matches using description or additionalDescriptions
          if (!food) {
            food = foods.find((f: any) =>
              normalizeUSDAName(f.description).includes(normalizedQuery.split(',')[0]) ||
              (f.additionalDescriptions &&
               f.additionalDescriptions.toLowerCase().includes(normalizedQuery.split(',')[0]))
            );
          }
          // If still none, default to the first result
          if (!food && foods.length > 0) {
            // Instead of picking first, we'll allow the user to select from top 10
            // But for now, keep food = null so we can handle below
            food = null;
          }
          if (food && food.description) {
            console.log(`   ✅ Selected food: ${food.description} (fdcId: ${food.fdcId})`);
          } else {
            console.log(`   ⚠️ No suitable match found for "${q}" in ${dt || 'All'}`);
          }
          // If food found, continue as before; otherwise, offer top results
          if (!food && foods.length > 0) {
            // Only return top results if this is the last fallback (dt is undefined or last in fallbackOrder)
            // But for now, always allow topResults if no match found
            const topResults = foods.slice(0, 10).map((f: any) => ({
              description: f.description,
              fdcId: f.fdcId,
              dataType: dt || 'All',
            }));
            console.log(`⚠️ No exact match for "${q}" — returning top 10 for user selection`);
            return { topResults };
          }
        }
        // (Old block for food selection removed/commented out)
        // let food = null;
        // if (foods.length > 0) {
        //   const normalizedQuery = normalizeUSDAName(q);
        //   // Try to find a close match where the USDA description contains the main keyword
        //   food = foods.find((f: any) =>
        //     f.description?.toLowerCase().includes(normalizedQuery.split(',')[0])
        //   ) || foods[0];
        // }
        // if (food && food.description) {
        //   console.log(`   ✅ Selected food: ${food.description} (fdcId: ${food.fdcId})`);
        // } else {
        //   console.log(`   ⚠️ No suitable match found for "${q}" in ${dt || 'All'}`);
        // }
        if (!food || !food.fdcId) continue;
        // Fetch full food report (with retry + logging)
        const foodResp = await fetch(
          `https://api.nal.usda.gov/fdc/v1/food/${food.fdcId}?api_key=${USDA_API_KEY}`
        );

        let foodJson;
        if (!foodResp.ok) {
          console.warn(`⚠️ Nutrient fetch failed for ${food.fdcId} (${food.description}), status ${foodResp.status}`);
          await new Promise(res => setTimeout(res, 500)); // small delay before retry
          const retryResp = await fetch(
            `https://api.nal.usda.gov/fdc/v1/food/${food.fdcId}?api_key=${USDA_API_KEY}`
          );
          if (!retryResp.ok) {
            console.error(`❌ Second fetch failed for ${food.fdcId}, skipping this item`);
            continue;
          } else {
            console.log(`🔁 Second fetch succeeded for ${food.fdcId}`);
            foodJson = await retryResp.json();
          }
        } else {
          foodJson = await foodResp.json();
        }

        console.log(`   🧩 Parsing nutrients for: ${foodJson.description || 'Unknown'}`);
        // 🍽️ Log all available portion size information for debugging
        let foodPortions: any[] = [];
        if (foodJson.foodPortions && Array.isArray(foodJson.foodPortions)) {
          foodPortions = foodJson.foodPortions;
          console.log(`🍽️ Portion options for "${foodJson.description}":`);
          foodJson.foodPortions.forEach((portion: any, idx: number) => {
            console.log(`  #${idx + 1}:`, {
              measureUnit: portion.measureUnit?.name || portion.modifier || 'Unknown',
              gramWeight: portion.gramWeight,
              portionDescription: portion.portionDescription,
              sequenceNumber: portion.sequenceNumber,
            });
          });
        } else {
          console.log(`🍽️ No portion information found for "${foodJson.description}"`);
        }
        // Debug preview of nutrients
        console.log("Full nutrient data preview:", foodJson.foodNutrients?.slice(0, 10));
        // Find macros: calories, protein, carbs, fat, fiber, sugar
        let calories: number | null = null,
            protein: number | null = null,
            carbs: number | null = null,
            fat: number | null = null,
            fiber: number | null = null,
            sugar: number | null = null;

        // Helper to convert kJ to kcal if needed
        const kJtoKcal = (kJ: number) => kJ * 0.239005736;

        // 1) Branded foods often use labelNutrients (per serving)
        if (foodJson.labelNutrients) {
          calories = foodJson.labelNutrients.calories?.value ?? calories;
          protein  = foodJson.labelNutrients.protein?.value ?? protein;
          carbs    = foodJson.labelNutrients.carbohydrates?.value ?? carbs;
          fat      = foodJson.labelNutrients.fat?.value ?? fat;
          fiber    = foodJson.labelNutrients.fiber?.value ?? fiber;
          sugar    = foodJson.labelNutrients.sugars?.value ?? sugar;
        }

        // 2) For Foundation / FNDDS and others, use foodNutrients array.
        // Use robust/safe parsing for all macro fields.
        if (foodJson.foodNutrients && Array.isArray(foodJson.foodNutrients)) {
          for (const n of foodJson.foodNutrients) {
            const name = (n.nutrientName || n.nutrient?.name || '').toLowerCase();
            const number = n.nutrientNumber || n.nutrient?.number || '';
            const id = n.nutrientId || n.nutrient?.id;
            const value = n.value ?? n.amount ?? null;
            const unit = (n.unitName || n.nutrient?.unitName || '').toUpperCase();
            if (value === null) continue;

            if (!calories && (number === '208' || id === 1008 || name.includes('energy'))) {
              calories = unit === 'KJ' ? value * 0.239005736 : value;
            } else if (!protein && (number === '203' || id === 1003 || name.includes('protein'))) {
              protein = value;
            } else if (!carbs && (number === '205' || id === 1005 || name.includes('carbohydrate'))) {
              carbs = value;
            } else if (!fat && (number === '204' || id === 1004 || name.includes('fat') || name.includes('lipid'))) {
              fat = value;
            } else if (!fiber && (number === '291' || id === 1079 || name.includes('fiber'))) {
              fiber = value;
            } else if (!sugar && (number === '269' || id === 2000 || name.includes('sugar'))) {
              sugar = value;
            }
          }
        }

        // Fallback for partial macro match: debug log
        if (foodJson.foodNutrients && (!calories || !protein || !carbs)) {
          console.log("⚠️ Partial macro match, attempting secondary nutrient extraction...");
          const alt = foodJson.foodNutrients.find((n: any) =>
            ['energy', 'protein', 'carbohydrate', 'fat', 'fiber', 'sugar'].some((k: string) =>
              (n.nutrientName || '').toLowerCase().includes(k)
            )
          );
          console.log("Alt nutrients:", alt);
        }

        // If any macros found, return them immediately
        if ([calories, protein, carbs, fat, fiber, sugar].some(v => v !== null)) {
          // Ensure every macro field has a value; assign 0 if still null
          calories = calories !== null ? calories : 0;
          protein = protein !== null ? protein : 0;
          carbs = carbs !== null ? carbs : 0;
          fat = fat !== null ? fat : 0;
          fiber = fiber !== null ? fiber : 0;
          sugar = sugar !== null ? sugar : 0;
          console.log(`✅ Parsed macros for "${foodJson.description}":`, { calories, protein, carbs, fat, fiber, sugar });
          // Extract brandName from USDA fields if available
          const brandName = foodJson.brandOwner || foodJson.brandName || null;
          // Attach foodPortions to the macros result for downstream use
          const macros = {
            calories,
            protein,
            carbs,
            fat,
            fiber,
            sugar,
            usdaDescription: foodJson.description || food.description || '',
            usdaDataType: foodJson.dataType || food.dataType || dataType || 'Unknown',
            servingSize: foodJson.servingSize || 100,
            servingSizeUnit: foodJson.servingSizeUnit || 'g',
            brandName,
            foodPortions: foodPortions || [],
          };
          foodCache.set(cacheKey, macros);
          return macros;
          // break outer; // Function returns; break not needed.
        } else {
          console.log(`   ❌ No macros found for "${foodJson.description}"`);
        }
        // Otherwise, continue to next fallback dataset
      }
    }
    // If all attempts fail, return null
    console.log(`❌ All attempts failed for ingredient: "${ingredientName}"`);
    return null;
  } catch (e) {
    return null;
  }
}

// import { GEMINI_API_KEY } from '@env';
const GEMINI_API_KEY = "AIzaSyBVIXV-Cu3bEM_7vkU2anLFpa8apFr_SJU"; // temporary hardcoded key

export default function LogMealScreen() {
  const router = useRouter();
  const [mealDescription, setMealDescription] = useState('');
  const [mealContext, setMealContext] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  // Ingredient: expanded structure
  const [editableItems, setEditableItems] = useState<{
    name: string;
    amount: string;
    unit?: string;
    grams_per_unit?: string;
    total_grams?: string;
    name_usda?: string;
    usda_dataset?: string;
    servingSize?: number;
    servingSizeUnit?: string;
    servingChoice?: 'default' | 'usda';
    scaledMacros?: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber: number;
      sugar: number;
    };
  }[]>([]);
  // Ingredient options for ambiguous USDA matches (parallel to editableItems)
  const [ingredientOptions, setIngredientOptions] = useState<(Array<{description:string, fdcId:number, dataType:string}>)[]>([]);
  // Macro data for each ingredient (aligned with editableItems)
  const [ingredientMacros, setIngredientMacros] = useState<
    ({
      calories: number | null;
      protein: number | null;
      carbs: number | null;
      fat: number | null;
      fiber: number | null;
      sugar: number | null;
      usdaDescription?: string;
      usdaDataType?: string;
      servingSize?: number;
      servingSizeUnit?: string;
      topResults?: Array<{ description: string; fdcId: number; dataType: string }>;
      brandName?: string;
      foodPortions?: any[];
    } | null)[]
  >([]);
  // Store the USDA base values (per 100g or per serving) for each ingredient, same structure as ingredientMacros
  const [ingredientBaseMacros, setIngredientBaseMacros] = useState<
    ({
      calories: number | null;
      protein: number | null;
      carbs: number | null;
      fat: number | null;
      fiber: number | null;
      sugar: number | null;
      usdaDescription?: string;
      usdaDataType?: string;
      servingSize?: number;
      servingSizeUnit?: string;
      topResults?: Array<{ description: string; fdcId: number; dataType: string }>;
      brandName?: string;
      foodPortions?: any[];
    } | null)[]
  >([]);
  const [analysisAbortController, setAnalysisAbortController] = useState<AbortController | null>(null);

  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [mealTitle, setMealTitle] = useState('');
  const [mealTitleEditing, setMealTitleEditing] = useState(false);

  console.log("Gemini Key:", GEMINI_API_KEY); // test

  // Ref for ScrollView to allow scrolling to inputs
  const scrollRef = React.useRef<ScrollView>(null);

  /**
   * Analyze a meal image using Gemini, including any meal context.
   * @param base64Image The image of the meal as a base64 string.
   * @param followUpAnswer Optional follow-up answer from the user.
   * @param mealContext Optional user context to help with analysis.
   * @param signal Optional AbortSignal to allow cancellation.
   */
  const analyzeMealWithGemini = async (
    base64Image: string,
    followUpAnswer?: string,
    mealContext?: string,
    signal?: AbortSignal
  ) => {
    let text = `You are Glucast, a nutrition assistant that analyzes meal photos and returns structured data compatible with the USDA FoodData Central API.

Your goal is to identify visible individual foods, estimate their portion sizes in both human-readable and USDA-compatible formats, and output clean JSON for direct parsing.

Follow these instructions carefully:

1. **Separate combination dishes** into their visible components.
   - For any dish where the name or appearance includes sauces, flavorings, or combined descriptors (such as "honey lemon chicken" or "garlic butter shrimp"), **break down the dish into its visible or named parts** whenever those parts are explicitly part of the meal’s name or appearance.
   - For example:
     - “honey lemon chicken” → detect “chicken, cooked”, “honey”, and “lemon juice”.
     - “garlic butter shrimp” → detect “shrimp, cooked”, “garlic”, and “butter”.
     - Spaghetti with tomato sauce → detect "spaghetti, cooked”, and "tomato sauce".
   - Even if the meal name includes a combined descriptor (like “honey lemon chicken”), you must **separate the components whenever they are ingredients or flavoring agents that contribute calories or nutrients.**
   - Example: “steak tacos” → detect “corn tortillas”, “grilled steak”, “diced onions”, “guacamole”, “lime wedge”.
   - When you see phrases like “with vegetables”, “mixed vegetables”, “and veggies”, or similar, **separate the vegetables from the main dish**. For example:
     - “fried rice with vegetables” → detect “fried rice” and “mixed vegetables”.
     - “chicken stir fry with vegetables” → detect “chicken, cooked” and “mixed vegetables”.
   - Do not return “steak tacos” as one item. Break them into individual components that could each be found in USDA.
   - Do NOT include invisible ingredients like salt, pepper, or oil unless they are clearly visible.
   - Always break apart combination or prepared meals (like “General Tso’s tofu”, “chicken alfredo”, “fried rice”, “pasta primavera”) into individual components such as protein, sauce, vegetables, rice, or noodles. Do not treat such dishes as a single item.

2. For each visible ingredient, include these fields:
   - \`name_user\`: user-friendly label (e.g., “Corn Tortillas”)
   - \`name_usda\`: 
      - If the food is a **branded or packaged item** (such as Doritos, Uncrustables, Coke, Snickers, McDonald's fries, etc.), you **must use the full brand name and product name** for \`name_usda\`, exactly as it appears on the packaging, including the brand, product, and variant details. For example, use “Uncrustables Peanut Butter & Strawberry Jam Sandwich”, “Doritos Nacho Cheese”, or “Coca-Cola Classic”.
      - If the food is **not branded** (a generic food, fruit, vegetable, staple, or homemade item), simplify the USDA-compatible food name by removing unnecessary descriptors like ", raw" or ", cooked" unless those are essential to identify the food (e.g., "chicken, roasted" or "egg, boiled"). For example, "orange, raw" should become "orange", "apple, raw" should become "apple".
      - **Never simplify or shorten the name_usda for branded foods. Always include full brand and variant details as seen on the product packaging.**
   - \`amount\`: number of units or quantity (numeric)
   - \`unit\`: the measurement unit (e.g., “slice”, “cup”, “piece”, “tortilla”)
   - \`grams_per_unit\`: estimated grams per unit
   - \`total_grams\`: total grams = amount × grams_per_unit (must be consistent)
   - \`is_branded\`: boolean. Set to true if the food is a recognizable packaged or brand-name item (e.g., Doritos, Coke, Snickers, McDonald's fries). Set to false for generic or unbranded foods (e.g., apple, rice, tortilla).
   - Use **g for solids** and **ml for liquids**.
Special rule for amounts:
- If the food is countable (like tortillas, eggs, nuggets, apples, slices of bread), return the count in the "amount" field and the per-unit weight in grams in "grams_per_unit".
  Example: 3 tortillas → "amount": 3, "grams_per_unit": 30, "total_grams": 90.
- If the food is NOT countable (like diced steak, rice, sauce, soup, diced tomatoes, mashed potatoes, guacamole), always set "amount" to 1 and set "grams_per_unit" equal to the total grams detected for that item.
  Example: diced tomatoes (120 g total) → "amount": 1, "grams_per_unit": 120, "total_grams": 120.
- Never guess counts for uncountable foods. Default to amount = 1 for those.

3. When something is measured by weight (like “150 g steak”), include both:
   - \`amount\`: numeric quantity (e.g., 150)
   - \`unit\`: “g”
   - \`grams_per_unit\`: 1
   - \`total_grams\`: equal to amount.

4. Always ensure that all weights and measures are **numerically consistent**:
   - total_grams = amount × grams_per_unit (must always be true).

- If a weight is given in pounds or fractions of a pound (like "1/8 lb"), automatically convert it to grams using the conversion 1 lb = 453.59237 g. 
- Always include both the numeric weight in grams and the converted value in the output.

5. **Portion realism rule:** Assume that meals shown belong to a single person for glucose prediction.
   - When estimating packaged or ambiguous foods (e.g., chips, candy, beverages), assume the **smaller or single-serve** version unless context or image clearly indicates otherwise.
   - For example: if a full bag of Doritos is visible, estimate it as a **single-serve snack bag (~28 g)** unless there is clear evidence the user consumed the entire large bag.
   - This helps ensure the output reflects realistic, individual portion sizes for glucose tracking.

6. Make sure \`name_usda\` matches USDA’s database conventions.
   - If a specific variant of a food  exists (e.g., tater tots vs. french fries, chicken nuggets vs. fried chicken), always choose the more specific match that best describes the visible food. For example, if tater tots are detected, the USDA-compatible name should be “potatoes, tater tots” rather than “potatoes, fried, french fries”.
   - “Steak” → “beef steak, cooked”
   - “Taco shell” → “tortilla, corn”
   - “Guac” → “guacamole”
   - “Lime wedge” → “lime, raw”
   - “Rice” → “rice, white, cooked”

7. The final response must be strictly formatted as valid JSON, like this:
{
  "mealName": "Steak Tacos with Guacamole",
  "items": [
    {
      "name_user": "Corn Tortillas",
      "name_usda": "tortillas, corn",
      "amount": 3,
      "unit": "tortilla",
      "grams_per_unit": 60,
      "total_grams": 180,
      "is_branded": false
    },
    {
      "name_user": "Grilled Steak",
      "name_usda": "beef steak, cooked",
      "amount": 150,
      "unit": "g",
      "grams_per_unit": 1,
      "total_grams": 150,
      "is_branded": false
    },
    {
      "name_user": "Guacamole",
      "name_usda": "guacamole",
      "amount": 1,
      "unit": "cup",
      "grams_per_unit": 230,
      "total_grams": 230,
      "is_branded": false
    }
  ]
}

8. If the food is a recognizable branded item (e.g., Doritos, Coke, Snickers, McDonald's fries, Uncrustables, etc.), include "is_branded": true.
   Otherwise, set "is_branded": false.

The USDA name (\`name_usda\`) must follow the naming conventions for the appropriate dataset:
   - For raw or unprocessed ingredients: use names like "apple, raw", "cilantro, raw", "carrot, raw".
   - For cooked or general prepared foods: include preparation style like "chicken breast, cooked, roasted" or "rice, white, cooked".
   - For multi-component meal names: include composite dish names like "taco, beef and cheese, on corn tortilla".
   - For packaged or branded products: **always include the full product name, including brand and variant, exactly as shown on the packaging** (e.g., "Uncrustables Peanut Butter & Strawberry Jam Sandwich", "Doritos Nacho Cheese", "Coca-Cola Classic").

Glucast will automatically determine which USDA dataset to use, in the following order:
1. FNDDS (Survey Foods)
2. Foundation Foods
3. Branded Foods
4. SR Legacy Foods

Do not include or guess a "data_type" field in your response. Your output should only contain the fields shown in the JSON example.
`;
    // Add mealContext if provided and non-empty
    if (mealContext && mealContext.trim().length > 0) {
      text += `\nThere is context the user gave for their meal that you need to factor in the analyzation if possible: ${mealContext}`;
    }
    if (followUpAnswer) {
      text += `\nUser follow-up answer: ${followUpAnswer}`;
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text
                },
                {
                  inline_data: { mime_type: "image/jpeg", data: base64Image }
                }
              ]
            }
          ]
        }),
        signal,
      }
    );
    if (!response.ok) {
      if (response.status === 503) {
        throw new Error('Service overloaded');
      }
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    // Parse the JSON content from the response
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error('No content received from Gemini API');
    }
    // The content might be a stringified JSON, parse it
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  };

  // Normalizes Gemini response items to { name, amount, unit, grams_per_unit, total_grams, name_usda }
  const normalizeItems = (items: any[]): {
    name: string;
    amount: string;
    unit?: string;
    grams_per_unit?: string;
    total_grams?: string;
    name_usda?: string;
    raw?: any;
  }[] => {
    return (Array.isArray(items) ? items : []).map((it: any) => {
      if (it && typeof it === 'object') {
        // If the new structure is present, use it
        const name = (it.name_user ?? it.name ?? it.item ?? it.food ?? '').toString();
        // Prefer numeric amount/units
        let amountStr = '';
        if (typeof it.amount === 'number' || (typeof it.amount === 'string' && it.amount.trim().length > 0)) {
          amountStr = it.amount.toString();
        } else if (it.quantity || it.qty || it.count || it.number) {
          const quantity = it.quantity ?? it.qty ?? it.count ?? it.number;
          amountStr = `${quantity}`;
        }
        // Compose display for legacy fallback
        let unit = it.unit ?? '';
        let grams_per_unit = it.grams_per_unit ?? '';
        let total_grams = it.total_grams ?? '';
        if (typeof grams_per_unit === 'number') grams_per_unit = grams_per_unit.toString();
        if (typeof total_grams === 'number') total_grams = total_grams.toString();
        // Fallback for legacy
        if (!unit && (it.units || it.measure)) unit = it.units ?? it.measure ?? '';
        if (!grams_per_unit && it.grams) grams_per_unit = it.grams.toString();
        if (!total_grams && it.grams) total_grams = it.grams.toString();
        return {
          name,
          amount: amountStr,
          unit,
          grams_per_unit,
          total_grams,
          name_usda: it.name_usda,
          raw: it,
        };
      }
      return { name: String(it), amount: '', unit: '', grams_per_unit: '', total_grams: '', name_usda: '', raw: it };
    });
  };

  // Helper to fetch all macros for current editableItems
  const fetchAllMacros = async (items: {name:string, amount:string, name_usda?:string, total_grams?:string, raw?: any}[]) => {
    setIngredientMacros(Array(items.length).fill(null));
    setIngredientOptions(Array(items.length).fill([]));
    // 1. Fetch and store the raw USDA macro data for each item as baseMacrosArr.
    const baseMacrosArr: (any | null)[] = await Promise.all(
      items.map(async (item, idx) => {
        try {
          const queryName = item.name_usda?.trim() || item.name?.trim();
          // Determine dataset order based on is_branded
          let fallbackOrder: string[] = [];
          if (item.raw?.is_branded === true) {
            // For branded foods, search: Branded, Survey (FNDDS), Foundation, SR Legacy
            fallbackOrder = ["Branded", "Survey (FNDDS)", "Foundation", "SR Legacy"];
          } else {
            // For non-branded foods, use original order
            fallbackOrder = ["Survey (FNDDS)", "Foundation", "Branded", "SR Legacy"];
          }
          // Determine itemDataType for fetchFoodData (use first in fallbackOrder)
          let itemDataType: string | undefined = fallbackOrder[0];
          if (!queryName) return null;

          // Fetch macros with caching and fallback, pass fallbackOrder as customFallbackOrder
          let macros = await fetchFoodData(queryName, undefined, fallbackOrder);
          let topResults: Array<{ description: string; fdcId: number; dataType: string }> = [];
          // Always fetch top 5 from each dataset, in the order determined above, and combine for dropdown
          let combinedResults: Array<{ description: string; fdcId: number; dataType: string }> = [];
          for (const ds of fallbackOrder) {
            const resp = await fetch(
              `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(queryName)}&dataType=${encodeURIComponent(ds)}&pageSize=5`
            );
            if (resp.ok) {
              const json = await resp.json();
              const foods = json.foods || [];
              const results = foods.slice(0, 5).map((f: any) => ({
                description: f.description,
                fdcId: f.fdcId,
                dataType: ds,
              }));
              combinedResults.push(...results);
            }
          }
          topResults = combinedResults;
          // If macros is present and has .topResults, don't use it; just show combinedResults for dropdown.
          if (macros && (macros as any).topResults) {
            macros = null;
          }
          // Always set topResults for dropdown, even if a match was found
          setIngredientOptions(prev => {
            const arr = [...prev];
            arr[idx] = topResults || [];
            return arr;
          });
          // Do NOT scale here; just return the USDA baseline macros.
          return macros;
        } catch (e) {
          console.error("Macro fetch error for item:", item.name, e);
          return null;
        }
      })
    );
    // 2. Set the base macros (unscaled) array
    setIngredientBaseMacros(baseMacrosArr);

    // 3. Create a scaledArr by scaling those base macros using the ratio of total_grams / servingSize.
    const scaledArr = baseMacrosArr.map((macros, idx) => {
      const item = items[idx];
      if (!macros || !item.total_grams || !macros.servingSize) {
        return macros;
      }
      const scale = parseFloat(item.total_grams) / macros.servingSize;
      // Only scale if scale is a valid number
      if (isNaN(scale)) return macros;
      return {
        ...macros,
        calories: macros.calories ? +(macros.calories * scale).toFixed(2) : null,
        protein: macros.protein ? +(macros.protein * scale).toFixed(2) : null,
        carbs: macros.carbs ? +(macros.carbs * scale).toFixed(2) : null,
        fat: macros.fat ? +(macros.fat * scale).toFixed(2) : null,
        fiber: macros.fiber ? +(macros.fiber * scale).toFixed(2) : null,
        sugar: macros.sugar ? +(macros.sugar * scale).toFixed(2) : null,
      };
    });
    // 4. Set ingredientMacros to the scaled values
    setIngredientMacros(scaledArr);
  };

  const handleAnalyze = async () => {
    try {
      Keyboard.dismiss();
      if (!photoUri) {
        Alert.alert('No photo', 'Please take a photo of your meal before analyzing.');
        return;
      }
      setAnalyzing(true);
      const abortController = new AbortController();
      setAnalysisAbortController(abortController);
      const base64Image = await FileSystem.readAsStringAsync(photoUri, {
        encoding: 'base64',
      });
      let result;
      try {
        result = await analyzeMealWithGemini(base64Image, undefined, mealContext, abortController.signal);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setAnalyzing(false);
          setAnalysisAbortController(null);
          return;
        }
        throw err;
      }
      console.log('Gemini analysis result:', result);
      let parsedResult = result;
      if (typeof result === 'string') {
        try {
          // Clean up Markdown code fences like ```json ... ```
          const cleaned = result.replace(/```json|```/g, '').trim();
          parsedResult = JSON.parse(cleaned);
        } catch (e) {
          console.error("Failed to parse result from Gemini:", result);
          parsedResult = { items: [] };
        }
      }
      if (parsedResult?.followUpQuestion) {
        setFollowUpQuestion(parsedResult.followUpQuestion);
        setAnalyzed(false);
        setAnalysisAbortController(null);
        return;
      }
      setAnalysisResult(parsedResult);
      setMealTitle(parsedResult.mealName || '');
      const normItems = normalizeItems(parsedResult?.items || []);
      setEditableItems(normItems);
      // Fetch macros for each detected item
      fetchAllMacros(normItems);
      // Do not set mealDescription from parsedResult.mealName here
      setAnalyzed(true);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // User cancelled, do nothing special
      } else if (error instanceof Error && error.message === 'Service overloaded') {
        Alert.alert('Service Overloaded', 'The service is overloaded right now. Please try again later.');
      } else {
        Alert.alert('Error', 'Something went wrong during analysis. Please try again.');
      }
      console.error(error);
    } finally {
      setAnalyzing(false);
      setAnalysisAbortController(null);
    }
  };

  // Handler to re-analyze with updated context
  const handleReanalyzeWithContext = async () => {
    try {
      setAnalyzing(true);
      if (!photoUri) {
        Alert.alert('No photo', 'Please take a photo of your meal before analyzing.');
        setAnalyzing(false);
        return;
      }
      const abortController = new AbortController();
      setAnalysisAbortController(abortController);
      const base64Image = await FileSystem.readAsStringAsync(photoUri, {
        encoding: 'base64',
      });
      let result;
      try {
        result = await analyzeMealWithGemini(base64Image, undefined, mealContext, abortController.signal);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setAnalyzing(false);
          setAnalysisAbortController(null);
          return;
        }
        throw err;
      }
      let parsedResult = result;
      if (typeof result === 'string') {
        try {
          const cleaned = result.replace(/```json|```/g, '').trim();
          parsedResult = JSON.parse(cleaned);
        } catch (e) {
          parsedResult = { items: [] };
        }
      }
      setAnalysisResult(parsedResult);
      setMealTitle(parsedResult.mealName || '');
      const normItems = normalizeItems(parsedResult?.items || []);
      setEditableItems(normItems);
      fetchAllMacros(normItems);
      setAnalyzed(true);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // User cancelled, do nothing special
      } else if (error instanceof Error && error.message === 'Service overloaded') {
        Alert.alert('Service Overloaded', 'The service is overloaded right now. Please try again later.');
      } else {
        Alert.alert('Error', 'Something went wrong during analysis. Please try again.');
      }
      console.error(error);
    } finally {
      setAnalyzing(false);
      setAnalysisAbortController(null);
    }
  };

  const handleFollowUpSubmit = async () => {
    try {
      setAnalyzing(true);
      const base64Image = photoUri ? await FileSystem.readAsStringAsync(photoUri, { encoding: 'base64' }) : '';
      const response = await analyzeMealWithGemini(base64Image + '', followUpAnswer, mealContext);
      let parsedResult = response;
      if (typeof response === 'string') {
        try {
          const cleaned = response.replace(/```json|```/g, '').trim();
          parsedResult = JSON.parse(cleaned);
        } catch {
          parsedResult = { items: [] };
        }
      }
      setAnalysisResult(parsedResult);
      setMealTitle(parsedResult.mealName || '');
      const normItems = normalizeItems(parsedResult?.items || []);
      setEditableItems(normItems);
      // Fetch macros for each detected item
      fetchAllMacros(normItems);
      // Do not set mealDescription from parsedResult.mealName here
      setAnalyzed(true);
      setFollowUpQuestion(null);
    } catch (e: any) {
      if (e instanceof Error && e.message === 'Service overloaded') {
        Alert.alert('Service Overloaded', 'The service is overloaded right now. Please try again later.');
      } else {
        Alert.alert('Error', 'Failed to process follow-up answer.');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  // Debounced fetch for ingredient macros to prevent lag while editing
  const debouncedFetchMacros = debounce(async (name: string, index: number) => {
    const macros = name.trim() ? await fetchFoodData(name) : null;
    setIngredientMacros(prev => {
      const arr = [...prev];
      // Only assign if macros is valid macro data (not topResults)
      if (macros && !('topResults' in macros)) {
        arr[index] = macros;
      }
      return arr;
    });
  }, 700);

  // For dynamic calculation of total grams
  const updateItem = (index: number, field: 'name' | 'amount' | 'grams_per_unit', value: string) => {
    setEditableItems(prev => {
      const updated = [...prev];
      let item = { ...updated[index] };
      item[field] = value;
      // If amount or grams_per_unit is being edited, recalc total_grams
      if (field === 'amount' || field === 'grams_per_unit') {
        const amt = parseFloat(field === 'amount' ? value ?? '0' : item.amount ?? '0');
        const gpu = parseFloat(field === 'grams_per_unit' ? value ?? '0' : item.grams_per_unit ?? '0');
        if (!isNaN(amt) && !isNaN(gpu)) {
          item.total_grams = (amt * gpu).toString();
        } else {
          item.total_grams = '';
        }
      }
      updated[index] = item;
      return updated;
    });
    if (field === 'name') {
      debouncedFetchMacros(value, index);
    }
    // Auto-recalculate macros if amount or grams_per_unit are changed
    if (field === 'amount' || field === 'grams_per_unit') {
      // We must use the updated value for field, but the rest from the latest editableItems
      const updatedItem = { ...editableItems[index], [field]: value };
      // Recalculate total_grams (should match the above logic)
      const amt = parseFloat(field === 'amount' ? value ?? '0' : updatedItem.amount ?? '0');
      const gpu = parseFloat(field === 'grams_per_unit' ? value ?? '0' : updatedItem.grams_per_unit ?? '0');
      let totalGrams = 0;
      if (!isNaN(amt) && !isNaN(gpu)) {
        totalGrams = amt * gpu;
      }
      // Use base macros for scaling, not the already-scaled ingredientMacros
      const baseMacros = ingredientBaseMacros[index];
      // Corrected scaling: always scale relative to 100g (USDA macros are per 100g)
      if (baseMacros && totalGrams) {
        // DETAILED LOGGING:
        console.log(`🔁 Recalculating macros for item ${index}:`);
        console.log(`   totalGrams = ${totalGrams}`);
        console.log(`   baseMacros (per 100g):`, baseMacros);

        const scale = totalGrams / 100;
        console.log(`   scale factor = ${scale}`);

        const scaled = {
          ...baseMacros,
          calories: baseMacros.calories ? +(baseMacros.calories * scale).toFixed(2) : null,
          protein: baseMacros.protein ? +(baseMacros.protein * scale).toFixed(2) : null,
          carbs: baseMacros.carbs ? +(baseMacros.carbs * scale).toFixed(2) : null,
          fat: baseMacros.fat ? +(baseMacros.fat * scale).toFixed(2) : null,
          fiber: baseMacros.fiber ? +(baseMacros.fiber * scale).toFixed(2) : null,
          sugar: baseMacros.sugar ? +(baseMacros.sugar * scale).toFixed(2) : null,
        };

        console.log(`   ✅ Scaled macros:`, scaled);

        setIngredientMacros(prev => {
          const newArr = [...prev];
          newArr[index] = scaled;
          return newArr;
        });
      }
    }
  };

  const addItem = () => {
    const newItem = { name: '', amount: '', unit: '', grams_per_unit: '', total_grams: '', name_usda: '' };
    setEditableItems(items => {
      const newArr = [...items, newItem];
      setEditingIndex(newArr.length - 1);
      // Add a placeholder for macros
      setIngredientMacros(macrosArr => [...macrosArr, null]);
      return newArr;
    });
  };

  const removeItem = (index:number) => {
    const updated = editableItems.filter((_, i) => i !== index);
    setEditableItems(updated);
    setIngredientMacros(macrosArr => macrosArr.filter((_, i) => i !== index));
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.5 });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleChoosePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Media library permission is required to choose photos');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.5 });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSaveMeal = async () => {
    try {
      // Compute total macros
      let totalMacros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };
      ingredientMacros.forEach(m => {
        if (m) {
          totalMacros.calories += m.calories || 0;
          totalMacros.protein += m.protein || 0;
          totalMacros.carbs += m.carbs || 0;
          totalMacros.fat += m.fat || 0;
          totalMacros.fiber += m.fiber || 0;
          totalMacros.sugar += m.sugar || 0;
        }
      });
      // Ensure each ingredient has total_grams (float) field
      const itemsWithTotalGrams = editableItems.map((item, i) => ({
        ...item,
        total_grams: editableItems[i] && editableItems[i].total_grams !== undefined
          ? parseFloat(editableItems[i].total_grams ?? '') || 0
          : 0,
      }));
      // Build a local meal object for local-first saving
      const localMeal = {
        id: Date.now().toString(),
        name: analysisResult?.mealName || '', // Save meal name from analysis result if available
        context: mealContext,
        items: itemsWithTotalGrams,
        totalMacros,   // ✅ added
        date: new Date().toISOString(),
        photo_url: photoUri,  // use photo_url for both local and Supabase
        synced: false,
      };
      // Retrieve existing meals from AsyncStorage
      let meals: any[] = [];
      try {
        const storedMeals = await AsyncStorage.getItem("meals");
        if (storedMeals) {
          meals = JSON.parse(storedMeals);
          if (!Array.isArray(meals)) meals = [];
        }
      } catch (e) {
        meals = [];
      }
      // Prepend the new meal and save back
      meals = [localMeal, ...meals];
      await AsyncStorage.setItem("meals", JSON.stringify(meals));
      // Alert user of local save
      Alert.alert('Saved!', 'Meal saved locally and will sync in background.');
      // Begin background sync to Supabase
      (async () => {
        try {
          // Get current user ID from Supabase auth
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();
          if (userError || !user) {
            // Not logged in, cannot sync
            return;
          }
          let photo_url: string | null = null;
          if (photoUri) {
            // Use a unique filename
            const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
            const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;
            // Get current session for access token
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const accessToken = session?.access_token;
            const fileName = `meal_${user.id}_${localMeal.id}.jpg`;
            const formData = new FormData();
            formData.append('file', {
              uri: photoUri,
              name: fileName,
              type: 'image/jpeg',
            } as any);
            const response = await fetch(`${supabaseUrl}/storage/v1/object/meals/${fileName}`, {
              method: 'POST',
              headers: {
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${accessToken}`,
              },
              body: formData,
            });
            if (!response.ok) {
              const errText = await response.text();
              console.error("Upload error detail:", errText);
              throw new Error('Upload failed');
            }
            photo_url = `${supabaseUrl}/storage/v1/object/public/meals/${fileName}`;
          }
          // Insert meal into Supabase and get the inserted row
          const { data: insertedMeal, error: insertError } = await supabase
            .from('meals')
            .insert([
              {
                user_id: user.id,
                name: localMeal.name,
                context: localMeal.context,
                photo_url,
                items: itemsWithTotalGrams,
                total_macros: totalMacros,   // ✅ added
                date: localMeal.date,
              },
            ])
            .select()
            .single();
          if (insertError) {
            throw insertError;
          }
          console.log('Meal synced');

          // Remove the temporary local draft from AsyncStorage (we only keep unsynced meals locally)
          try {
            const stored = await AsyncStorage.getItem('meals');
            if (stored) {
              const localArr = JSON.parse(stored);
              const filtered = Array.isArray(localArr)
                ? localArr.filter((m: any) => m.id !== localMeal.id)
                : [];
              await AsyncStorage.setItem('meals', JSON.stringify(filtered));
            }
          } catch (pruneErr) {
            console.warn('Failed to prune local unsynced meals after sync', pruneErr);
          }
        } catch (e) {
          console.error('Background Supabase sync failed:', e);
        }
      })();
      // Reset all analysis-related state so the analyze meal form resets completely
      setAnalyzed(false);
      setAnalysisResult(null);
      setPhotoUri(null);
      setMealDescription('');
      setMealContext('');
      setMealTitle('');
      setEditableItems([]);
    } catch (e) {
      console.error('Error saving meal:', e);
      Alert.alert('Error', 'Failed to save meal.');
    }
  };

  // Track which item is in edit modef
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // Track which ingredient dropdowns are expanded (for USDA matches)
  const [expandedDropdowns, setExpandedDropdowns] = useState<boolean[]>([]);

  // Collapsible state for USDA portion options
  const [showPortions, setShowPortions] = useState<Record<string, boolean>>({});
  // Collapsed state for Detected Items section
  const [detectedItemsCollapsed, setDetectedItemsCollapsed] = useState(false);

  // Collapsed state for Ingredient Macros section
  const [macrosCollapsed, setMacrosCollapsed] = useState(false);

  // Coerce any possibly-null macro number to a safe number
  const num = (v: any): number => (typeof v === 'number' && isFinite(v) ? v : 0);


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex:1, backgroundColor: colors.background }}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding:16, paddingBottom:400 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
        <Text style={{ fontSize:20, fontWeight:'600', color: colors.text, marginBottom:20 }}>What did you eat?</Text>

        <Card style={{ marginBottom:20 }}>
          <Text style={{ fontSize:16, fontWeight:'500', marginBottom:12, color: colors.text }}>
            Add a Photo and/or Context
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: colors.background,
              borderRadius:12,
              padding:40,
              alignItems:'center',
              marginBottom:16,
              borderWidth:2,
              borderColor: colors.border,
              borderStyle:'dashed'
            }}
            onPress={() => {
              Alert.alert(
                'Add Photo',
                'Choose an option',
                [
                  { text: 'Take Photo', onPress: handleTakePhoto },
                  { text: 'Choose from Library', onPress: handleChoosePhoto },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            }}
          >
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={{ width: '100%', height: 200, borderRadius: 12 }}
                resizeMode="cover"
              />
            ) : (
              <>
                <Text style={{ fontSize:48, marginBottom:8 }}>📸</Text>
                <Text style={{ color: colors.text, opacity:0.7 }}>Tap to add a photo of your meal!</Text>
                <Text style={{ color: colors.text, opacity:0.5, fontSize:12 }}>Take one or choose from library</Text>
              </>
            )}
          </TouchableOpacity>

          <TextInput
            placeholder="If there is any context that can help with analysis, include it here!"
            placeholderTextColor="#999"
            value={mealContext}
            onChangeText={setMealContext}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            autoCorrect={true}
            autoCapitalize="sentences"
            style={{
              borderWidth:1,
              borderColor: colors.border,
              borderRadius:12,
              padding:16,
              fontSize:16,
              backgroundColor: colors.card,
              textAlignVertical:'top',
              minHeight:100,
              flexWrap:'wrap'
            }}
          />
          {/* Re-analyze with Updated Context Button */}
          {mealContext.trim().length > 0 && analyzed && (
            <PrimaryButton
              title="Re-analyze with Updated Context"
              onPress={handleReanalyzeWithContext}
              style={{ marginTop: 12 }}
              disabled={analyzing}
            />
          )}
        </Card>

        {!analyzed && (
          <>
            {followUpQuestion && !analyzed && (
              <Card style={{ marginBottom:20 }}>
                <Text style={{ fontSize:16, fontWeight:'600', marginBottom:12, color: colors.text }}>
                  Gemini needs more info:
                </Text>
                <Text style={{ marginBottom:12, color: colors.text }}>{followUpQuestion}</Text>
                <TextInput
                  placeholder="Your answer..."
                  value={followUpAnswer}
                  onChangeText={setFollowUpAnswer}
                  style={{ borderWidth:1, borderColor: colors.border, borderRadius:12, padding:12, backgroundColor: colors.card, marginBottom:12 }}
                />
                <PrimaryButton title="Submit" onPress={handleFollowUpSubmit} />
              </Card>
            )}
            <PrimaryButton
              title={analyzing ? 'Analyzing…' : 'Analyze Meal'}
              onPress={handleAnalyze}
              disabled={!mealDescription.trim() && !photoUri || analyzing}
              style={{ marginBottom: analyzing ? 8 : 20 }}
            />
            {analyzing && (
              <TouchableOpacity
                style={{
                  borderWidth: 2,
                  borderColor: colors.primary,
                  borderRadius: 12,
                  paddingHorizontal: 24,
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 56,
                  marginBottom: 12,
                }}
                onPress={() => {
                  if (analysisAbortController) {
                    analysisAbortController.abort();
                    setAnalyzing(false);
                    setAnalysisAbortController(null);
                  }
                }}
                disabled={!analyzing}
              >
                <Text style={{ color: colors.primary, fontSize:16, fontWeight:'600' }}>Cancel</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {analyzed && (
          <>
            <Card style={{ marginBottom:20 }}>
              {/* Meal name row with collapse toggle icon on the left */}
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <TouchableOpacity onPress={() => setDetectedItemsCollapsed(!detectedItemsCollapsed)} style={{ marginRight: 8 }}>
                  <Ionicons
                    name={detectedItemsCollapsed ? 'add-circle-outline' : 'remove-circle-outline'}
                    size={22}
                    color={colors.primary}
                  />
                </TouchableOpacity>
                {mealTitleEditing ? (
                  <TextInput
                    value={mealTitle}
                    onChangeText={setMealTitle}
                    style={{
                      flex:1,
                      fontSize:20,
                      fontWeight:'700',
                      color: colors.primary,
                      backgroundColor: colors.card,
                      borderRadius:6,
                      padding:6,
                      marginRight:8,
                    }}
                    autoFocus
                  />
                ) : (
                  <Text style={{
                    fontSize:20,
                    fontWeight:'700',
                    color: colors.primary,
                    flex:1,
                    marginBottom:0,
                  }}>
                    {mealTitle}
                  </Text>
                )}
                {mealTitleEditing ? (
                  <TouchableOpacity onPress={() => setMealTitleEditing(false)} style={{ padding:6 }}>
                    <Ionicons name="checkmark" size={22} color={colors.success || "#2ecc40"} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setMealTitleEditing(true)} style={{ padding:6 }}>
                    <Ionicons name="pencil" size={20} color={colors.text} />
                  </TouchableOpacity>
                )}
              </View>
              {/* Detected Items header and collapsible section */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Detected Items</Text>
              </View>
              {detectedItemsCollapsed ? null : (
                <>
                  {editableItems.map((item, i) => (
                    <React.Fragment key={i}>
                    <View style={{ marginBottom: 16 }}>
                      <View style={{ flex: 1 }}>
                        {editingIndex === i ? (
                          <View
                            style={{
                              backgroundColor: colors.card,
                              borderRadius: 8,
                              padding: 10,
                              borderWidth: 1,
                              borderColor: colors.border,
                              marginBottom: 8,
                            }}
                          >
                            {/* Editable ingredient name */}
                            <TextInput
                              value={item.name}
                              onChangeText={text => updateItem(i, 'name', text)}
                              style={{
                                fontSize: 15,
                                fontWeight: '600',
                                color: colors.text,
                                marginBottom: 8,
                                backgroundColor: colors.background,
                                borderRadius: 6,
                                padding: 6,
                              }}
                              placeholder="Ingredient name"
                              autoFocus
                            />

                            {/* Portion size row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                              <Text style={{ color: colors.text, opacity: 0.6, width: 100 }}>Portion size:</Text>
                              <TextInput
                                value={item.grams_per_unit}
                                onChangeText={text => updateItem(i, 'grams_per_unit', text)}
                                keyboardType="numeric"
                                style={{
                                  flex: 1,
                                  backgroundColor: colors.background,
                                  borderRadius: 6,
                                  padding: 6,
                                  fontSize: 14,
                                  color: colors.text,
                                }}
                                placeholder="e.g. 10"
                              />
                              <Text style={{ color: colors.text, marginLeft: 4 }}>g each</Text>
                            </View>

                            {/* Amount row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                              <Text style={{ color: colors.text, opacity: 0.6, width: 100 }}>Amount:</Text>
                              <TextInput
                                value={item.amount}
                                onChangeText={text => updateItem(i, 'amount', text)}
                                keyboardType="numeric"
                                style={{
                                  flex: 1,
                                  backgroundColor: colors.background,
                                  borderRadius: 6,
                                  padding: 6,
                                  fontSize: 14,
                                  color: colors.text,
                                }}
                                placeholder="e.g. 3"
                              />
                              <Text style={{ color: colors.text, marginLeft: 4 }}>{item.unit || (item as any)?.raw?.unit || ''}</Text>
                            </View>

                            {/* Total amount row (read-only, updates live) */}
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ color: colors.text, opacity: 0.6, width: 100 }}>Total amount:</Text>
                              <Animated.Text
                                style={{
                                  flex: 1,
                                  fontWeight: '600',
                                  fontSize: 14,
                                  color: colors.primary,
                                }}
                              >
                                {item.total_grams ? `${item.total_grams} g` : '—'}
                              </Animated.Text>
                            </View>

                            {/* USDA/Gemini grams toggle dropdown */}
                            {item.servingSize && item.servingSizeUnit && (
                              <Picker
                                selectedValue={item.servingChoice || 'default'}
                                style={{ height: 40, width: 220 }}
                                onValueChange={(val: 'default' | 'usda') => {
                                  // 🍽️ Portion type log
                                  console.log(`🍽️ Portion change for ${item.name}:`, {
                                    selected: val,
                                    servingSize: item.servingSize,
                                    servingSizeUnit: item.servingSizeUnit,
                                    totalGrams: item.total_grams,
                                  });
                                  const updatedItems = [...editableItems];
                                  updatedItems[i].servingChoice = val;

                                  const baseMacros = ingredientBaseMacros[i];
                                  // Guard: if we don't have base macros yet, just store the choice and exit
                                  if (!baseMacros) {
                                    setEditableItems(updatedItems);
                                    return;
                                  }

                                  if (val === 'usda') {
                                    // Use USDA serving size; default to 100g if undefined
                                    const usdaSize = typeof item.servingSize === 'number' && isFinite(item.servingSize) ? item.servingSize : 100;
                                    const scaleFactor = usdaSize / 100;

                                    updatedItems[i].scaledMacros = {
                                      calories: num(baseMacros.calories) * scaleFactor,
                                      carbs:    num(baseMacros.carbs)    * scaleFactor,
                                      fat:      num(baseMacros.fat)      * scaleFactor,
                                      protein:  num(baseMacros.protein)  * scaleFactor,
                                      fiber:    num(baseMacros.fiber)    * scaleFactor,
                                      sugar:    num(baseMacros.sugar)    * scaleFactor,
                                    };
                                    updatedItems[i].total_grams = String(usdaSize);

                                    // Reflect into ingredientMacros too
                                    setIngredientMacros(prev => {
                                      const arr = [...prev];
                                      arr[i] = {
                                        ...baseMacros,
                                        calories: +(num(baseMacros.calories) * scaleFactor).toFixed(2),
                                        protein:  +(num(baseMacros.protein)  * scaleFactor).toFixed(2),
                                        carbs:    +(num(baseMacros.carbs)    * scaleFactor).toFixed(2),
                                        fat:      +(num(baseMacros.fat)      * scaleFactor).toFixed(2),
                                        fiber:    +(num(baseMacros.fiber)    * scaleFactor).toFixed(2),
                                        sugar:    +(num(baseMacros.sugar)    * scaleFactor).toFixed(2),
                                      } as any;
                                      return arr;
                                    });
                                  } else {
                                    // Use Gemini's estimated grams
                                    const totalGrams = Number.parseFloat(item.total_grams ?? '') || 0;
                                    const scaleFactor = totalGrams > 0 ? totalGrams / 100 : 0;

                                    updatedItems[i].scaledMacros = {
                                      calories: num(baseMacros.calories) * scaleFactor,
                                      carbs:    num(baseMacros.carbs)    * scaleFactor,
                                      fat:      num(baseMacros.fat)      * scaleFactor,
                                      protein:  num(baseMacros.protein)  * scaleFactor,
                                      fiber:    num(baseMacros.fiber)    * scaleFactor,
                                      sugar:    num(baseMacros.sugar)    * scaleFactor,
                                    };

                                    setIngredientMacros(prev => {
                                      const arr = [...prev];
                                      arr[i] = {
                                        ...baseMacros,
                                        calories: +(num(baseMacros.calories) * scaleFactor).toFixed(2),
                                        protein:  +(num(baseMacros.protein)  * scaleFactor).toFixed(2),
                                        carbs:    +(num(baseMacros.carbs)    * scaleFactor).toFixed(2),
                                        fat:      +(num(baseMacros.fat)      * scaleFactor).toFixed(2),
                                        fiber:    +(num(baseMacros.fiber)    * scaleFactor).toFixed(2),
                                        sugar:    +(num(baseMacros.sugar)    * scaleFactor).toFixed(2),
                                      } as any;
                                      return arr;
                                    });
                                  }

                                  setEditableItems(updatedItems);
                                }}
                              >
                                <Picker.Item label={`Default (${item.total_grams} g)`} value="default" />
                                <Picker.Item label={`USDA Serving (1 ${item.servingSizeUnit} = ${item.servingSize} g)`} value="usda" />
                              </Picker>
                            )}
                          </View>
                        ) : (
                          <View style={{ backgroundColor: colors.card, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}>
                            {/* Ingredient name (read-only) */}
                            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 8 }}>{item.name}</Text>
                            {/* Portion size row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                              <Text style={{ color: colors.text, opacity: 0.6, width: 100 }}>Portion size:</Text>
                              <Text style={{ fontSize: 14, color: colors.text }}>{item.grams_per_unit || '—'} g each</Text>
                            </View>
                            {/* Amount row */}
                            {/* Amount row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                            <Text style={{ color: colors.text, opacity: 0.6, width: 100 }}>Amount:</Text>
                              <Text style={{ fontSize: 14, color: colors.text }}>
                              {item.amount
                              ? `${item.amount} portion${item.amount === '1' ? '' : 's'} of ${item.name || (item as any)?.raw?.name || 'portion'}`
                              : '—'}
                             </Text>
                            </View>
                            {/* Total amount row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ color: colors.text, opacity: 0.6, width: 100 }}>Total amount:</Text>
                              <Text style={{ fontWeight: '600', fontSize: 14, color: colors.primary }}>
                                {item.total_grams ? `${item.total_grams} g` : '—'}
                              </Text>
                            </View>
                            {/* USDA: show name_usda if present */}
                            {item.name_usda ? (
                              <Text style={{ fontSize: 11, color: colors.text, opacity: 0.5, marginTop: 6 }}>
                                USDA: {item.name_usda}
                              </Text>
                            ) : null}
                            {/* Portion options from USDA (duplicated from Ingredient Macros section) */}
                            {Array.isArray(ingredientBaseMacros[i]?.foodPortions) && ingredientBaseMacros[i].foodPortions.length > 0 && (
                              <>
                                <TouchableOpacity
                                  onPress={() => setShowPortions(prev => ({ ...prev, [i]: !prev[i] }))}
                                >
                                  <Text style={{ color: colors.primary, fontWeight: "bold", marginTop: 6 }}>
                                    Portion options {showPortions[i] ? "▲" : "▼"}
                                  </Text>
                                </TouchableOpacity>
                                {showPortions[i] && (
                                  <View style={{ marginTop: 4 }}>
                                    {ingredientBaseMacros[i].foodPortions
                                      .filter((p: any) => {
                                        const desc = p.portionDescription?.toLowerCase() || "";
                                        const mod = p.modifier?.toLowerCase() || "";
                                        return !desc.includes("quantity not specified") && !mod.includes("quantity not specified");
                                      })
                                      .map((portion: any, idx: number) => (
                                        <TouchableOpacity
                                          key={idx}
                                          onPress={() => {
                                            const updated = [...editableItems];
                                            updated[i].grams_per_unit = portion.gramWeight?.toString() || "";
                                            // Recalculate total grams if amount is set
                                            const amt = parseFloat(updated[i].amount ?? "0");
                                            const gpu = parseFloat(updated[i].grams_per_unit ?? "0");
                                            if (!isNaN(amt) && !isNaN(gpu)) {
                                              updated[i].total_grams = (amt * gpu).toString();
                                            }
                                            setEditableItems(updated);

                                            // ✅ Immediately recalculate and update macros
                                            const baseMacros = ingredientBaseMacros[i];
                                            const totalGrams = parseFloat(updated[i].total_grams ?? "0");
                                            if (baseMacros && totalGrams > 0) {
                                              const scale = totalGrams / 100;
                                              const scaled = {
                                                ...baseMacros,
                                                calories: baseMacros.calories ? +(baseMacros.calories * scale).toFixed(2) : null,
                                                protein: baseMacros.protein ? +(baseMacros.protein * scale).toFixed(2) : null,
                                                carbs: baseMacros.carbs ? +(baseMacros.carbs * scale).toFixed(2) : null,
                                                fat: baseMacros.fat ? +(baseMacros.fat * scale).toFixed(2) : null,
                                                fiber: baseMacros.fiber ? +(baseMacros.fiber * scale).toFixed(2) : null,
                                                sugar: baseMacros.sugar ? +(baseMacros.sugar * scale).toFixed(2) : null,
                                              };
                                              setIngredientMacros(prev => {
                                                const newArr = [...prev];
                                                newArr[i] = scaled;
                                                return newArr;
                                              });
                                            }

                                            console.log(`✅ Portion selected for ${updated[i].name}:`, {
                                              portion: portion.portionDescription || portion.modifier,
                                              grams_per_unit: updated[i].grams_per_unit,
                                              total_grams: updated[i].total_grams
                                            });
                                          }}
                                        >
                                          <Text style={{ fontSize: 12, color: colors.primary, opacity: 0.8 }}>
                                            {portion.portionDescription
                                              ? `${portion.portionDescription} — ${portion.gramWeight} g`
                                              : portion.modifier
                                                ? `${portion.amount} ${portion.modifier} — ${portion.gramWeight} g`
                                                : ""}
                                          </Text>
                                        </TouchableOpacity>
                                      ))}
                                  </View>
                                )}
                              </>
                            )}
                            {/* USDA/Gemini grams toggle dropdown (view mode) */}
                            {item.servingSize && item.servingSizeUnit && (
                              <Picker
                                enabled={false}
                                selectedValue={item.servingChoice || 'default'}
                                style={{ height: 40, width: 220, opacity: 0.5 }}
                              >
                                <Picker.Item label={`Default (${item.total_grams} g)`} value="default" />
                                <Picker.Item label={`USDA Serving (1 ${item.servingSizeUnit} = ${item.servingSize} g)`} value="usda" />
                              </Picker>
                            )}
                          </View>
                        )}
                      </View>
                      {/* Edit & Delete Icons directly below card */}
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginTop: 10,
                          marginBottom: 12,
                        }}
                      >
                        {editingIndex === i ? (
                          <TouchableOpacity
                            onPress={() => setEditingIndex(null)}
                            style={{ padding: 6, marginHorizontal: 10 }}
                            accessibilityLabel="Confirm"
                          >
                            <Ionicons name="checkmark" size={22} color="#2ecc40" />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => setEditingIndex(i)}
                            style={{ padding: 6, marginHorizontal: 10 }}
                            accessibilityLabel="Edit"
                          >
                            <Ionicons name="pencil" size={20} color={colors.text} />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => {
                            removeItem(i);
                            setEditingIndex(editIdx =>
                              editIdx === i ? null : editIdx !== null && editIdx > i ? editIdx - 1 : editIdx
                            );
                          }}
                          style={{ padding: 6, marginHorizontal: 10 }}
                          accessibilityLabel="Delete"
                        >
                          <Ionicons name="trash-outline" size={22} color="#d11a2a" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {/* Separator line between items, except after last */}
                    {i < editableItems.length - 1 && (
                      <View
                      style={{
                      height: 1.5,
                      backgroundColor: colors.border || '#000',
                      opacity: 0.8,
                      marginVertical: 10,
                      }}
                      />
                      )}
                    </React.Fragment>
                  ))}
                  <TouchableOpacity onPress={addItem} style={{ marginTop:12 }}>
                    <Text style={{ color: colors.primary, fontWeight:'600' }}>+ Add Ingredient</Text>
                  </TouchableOpacity>
                </>
              )}
            </Card>

{/* Nutrition/macros card - collapsible */}
<Card style={{ marginBottom: 20 }}>
<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 12 }}>
      <TouchableOpacity onPress={() => setMacrosCollapsed(!macrosCollapsed)} style={{ marginRight: 8 }}>
      <Ionicons
        name={macrosCollapsed ? 'add-circle-outline' : 'remove-circle-outline'}
        size={22}
        color={colors.primary}
      />
    </TouchableOpacity>
    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary }}>
      Ingredient Macros
    </Text>
  </View>

  {!macrosCollapsed && (
    <>
      {editableItems.map((item, i) => (
        <View
          key={i}
          style={{
            backgroundColor: colors.card,
            borderRadius: 10,
            padding: 12,
            marginBottom: 12,
            shadowColor: '#000',
            shadowOpacity: 0.03,
            shadowRadius: 2,
          }}
        >
          <Text style={{ fontWeight: '700', fontSize: 15, color: colors.primary, marginBottom: 4 }}>
            {item.name || 'Unknown Ingredient'}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            {[
              { label: 'Calories (kcal)', value: ingredientMacros[i]?.calories },
              { label: 'Protein (g)', value: ingredientMacros[i]?.protein },
              { label: 'Carbs (g)', value: ingredientMacros[i]?.carbs },
              { label: 'Fat (g)', value: ingredientMacros[i]?.fat },
              { label: 'Fiber (g)', value: ingredientMacros[i]?.fiber },
              { label: 'Sugar (g)', value: ingredientMacros[i]?.sugar },
            ].map((macro, j) => (
              <View
                key={j}
                style={{
                  width: '33%',
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRightWidth: j % 3 !== 2 ? 1 : 0,
                  borderBottomWidth: j < 3 ? 1 : 0,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                }}
              >
                <Text style={{ color: colors.text, opacity: 0.6, fontSize: 13, marginBottom: 2 }}>
                  {macro.label}
                </Text>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
                  {macro.value ?? '-'}
                </Text>
              </View>
            ))}
          </View>

          {ingredientMacros[i]?.usdaDescription && (
            <Text style={{ fontSize: 11, color: colors.text, opacity: 0.6, marginTop: 6 }}>
              Source: {ingredientMacros[i]?.usdaDescription}
              {ingredientMacros[i]?.usdaDataType ? ` (${ingredientMacros[i]?.usdaDataType})` : ''}
            </Text>
          )}
          {ingredientMacros[i]?.brandName && (
            <Text style={{ fontSize: 11, color: colors.text, opacity: 0.6, marginTop: 2 }}>
              Brand: {ingredientMacros[i]?.brandName}
            </Text>
          )}
                      {/* Alternate USDA Options Dropdown */}
{Array.isArray(ingredientOptions[i]) && ingredientOptions[i].length > 0 && (
  <View style={{ marginTop: 8 }}>
    <TouchableOpacity
      onPress={() =>
        setShowPortions(prev => ({ ...prev, [`usda_${i}`]: !prev[`usda_${i}`] }))
      }
    >
      <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
        Alternate USDA Options {showPortions[`usda_${i}`] ? '▲' : '▼'}
      </Text>
    </TouchableOpacity>

    {showPortions[`usda_${i}`] && (
      <View style={{ marginTop: 6, paddingLeft: 6 }}>
        {ingredientOptions[i].map((opt, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={async () => {
              const result = await fetchFoodData(opt.description, opt.dataType);
              if (!result || (result as any).topResults) return;

              const macros = result as {
                calories: number | null;
                protein: number | null;
                carbs: number | null;
                fat: number | null;
                fiber: number | null;
                sugar: number | null;
                servingSize?: number;
                servingSizeUnit?: string;
              };

              const totalGrams = parseFloat(editableItems[i]?.total_grams ?? '0');
              const scale = totalGrams > 0 ? totalGrams / 100 : 1;

              const scaled = {
                ...macros,
                calories: +(macros.calories! * scale).toFixed(2),
                protein: +(macros.protein! * scale).toFixed(2),
                carbs: +(macros.carbs! * scale).toFixed(2),
                fat: +(macros.fat! * scale).toFixed(2),
                fiber: +(macros.fiber! * scale).toFixed(2),
                sugar: +(macros.sugar! * scale).toFixed(2),
                usdaDescription: opt.description,
                usdaDataType: opt.dataType,
              };

              setIngredientBaseMacros(prev => {
                const arr = [...prev];
                arr[i] = macros;
                return arr;
              });

              setIngredientMacros(prev => {
                const arr = [...prev];
                arr[i] = scaled;
                return arr;
              });

              setEditableItems(prev => {
                const arr = [...prev];
                arr[i].name_usda = opt.description;
                return arr;
              });

              // Collapse after selecting
              setShowPortions(prev => ({ ...prev, [`usda_${i}`]: false }));
            }}
          >
            <Text style={{ fontSize: 13, color: colors.text, marginVertical: 2 }}>
              • {opt.description} ({opt.dataType})
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    )}
  </View>
)}
         
        </View>
      ))}
    </>
  )}
</Card>

            {/* Total Macros section */}
            {ingredientMacros.filter(
              m => m &&
                (typeof m.calories === 'number' ||
                 typeof m.protein === 'number' ||
                 typeof m.carbs === 'number' ||
                 typeof m.fat === 'number' ||
                 typeof m.fiber === 'number' ||
                 typeof m.sugar === 'number')
            ).length > 0 && (
              <Card style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: colors.primary }}>
                  Total Macros
                </Text>
                {(() => {
                  // Sum up all macros, explicitly type total as non-null object with number fields
                  const total = ingredientMacros.reduce(
                    (acc, m) => {
                      if (!m) return acc;
                      return {
                        calories: acc.calories + (m.calories ?? 0),
                        protein: acc.protein + (m.protein ?? 0),
                        carbs: acc.carbs + (m.carbs ?? 0),
                        fat: acc.fat + (m.fat ?? 0),
                        fiber: acc.fiber + (m.fiber ?? 0),
                        sugar: acc.sugar + (m.sugar ?? 0),
                      };
                    },
                    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 } as {
                      calories: number;
                      protein: number;
                      carbs: number;
                      fat: number;
                      fiber: number;
                      sugar: number;
                    }
                  );
                  // Helper to format macro values (show 2 decimals if not int)
                  const fmt = (v: number) => Number.isNaN(v) ? '-' : (Math.round(v) === v ? v : v.toFixed(2));
                  // 2x3 grid
                  return (
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                        overflow: 'hidden',
                        backgroundColor: colors.background,
                      }}
                    >
                      {[
                        { label: 'Total Calories (kcal)', value: total.calories },
                        { label: 'Total Protein (g)', value: total.protein },
                        { label: 'Total Carbs (g)', value: total.carbs },
                        { label: 'Total Fat (g)', value: total.fat },
                        { label: 'Total Fiber (g)', value: total.fiber },
                        { label: 'Total Sugar (g)', value: total.sugar },
                      ].map((macro, idx) => (
                        <View
                          key={idx}
                          style={{
                            width: '33%',
                            paddingVertical: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRightWidth: (idx % 3 !== 2) ? 1 : 0,
                            borderBottomWidth: idx < 3 ? 1 : 0,
                            borderColor: colors.border,
                          }}
                        >
                          <Text style={{ color: colors.text, opacity: 0.6, fontSize: 13, marginBottom: 2, fontWeight: '500' }}>
                            {macro.label}
                          </Text>
                          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
                            {fmt(macro.value)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </Card>
            )}



            <View style={{ marginBottom:20 }}>
              <PrimaryButton title="Save to Log" onPress={handleSaveMeal} style={{ flex:1 }} />
            </View>

            <PrimaryButton
              title="Analyze Another Meal"
              onPress={() => {
                setAnalyzed(false);
                setAnalysisResult(null);
                setPhotoUri(null);
                setMealDescription('');
                setMealContext('');
              }}
              style={{ marginBottom:20 }}
            />
          </>
        )}
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}


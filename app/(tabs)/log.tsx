import React, { useState } from 'react';
import { decode as atob } from 'base-64';
import { SafeAreaView, StatusBar, ScrollView, View, Text, TouchableOpacity, TextInput, Alert, Image, Animated, Keyboard } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Swipeable } from 'react-native-gesture-handler';

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
  // Ingredient: { name: string, amount: string }
  const [editableItems, setEditableItems] = useState<{ name: string, amount: string }[]>([]);
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
    let text = `You are Glucast, a friendly nutrition assistant. Analyze the given meal photo as fast as you can.

1. If you clearly see branded food packaging (like Eggo waffles, Coca-Cola, Oreos, etc.), identify the **specific brand and product name**. If possible, include a short list of the ingredients (pulled from your knowledge base of common packaged foods). 
2. If there is no clear brand or packaging, output what the user is eating in terms of visible food items (e.g. "Pancakes", "Syrup", "Butter"). Do not break these into recipe ingredients like flour or eggs unless the food itself is shown unprepared.
3. Always provide portion estimates in standard, consistent units such as grams, cups, slices, or tablespoons.

Respond strictly in JSON with the following structure:
{
  mealName: string,
  items: [ { name: string, amount: string } ]
}`;
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

  // Normalizes Gemini response items to { name, amount }
  const normalizeItems = (items: any[]): { name: string; amount: string }[] => {
    return (Array.isArray(items) ? items : []).map((it: any) => {
      if (it && typeof it === 'object') {
        const name = (it.name ?? it.item ?? it.food ?? '').toString();
        // Try to find an explicit 'amount' field, else synthesize from quantity/unit/grams/ml/oz etc.
        let amount = '';
        if (typeof it.amount === 'string' && it.amount.trim().length > 0) {
          amount = it.amount;
        } else if (it.quantity || it.qty || it.count || it.number) {
          const quantity = it.quantity ?? it.qty ?? it.count ?? it.number;
          const unit = it.unit ?? it.units ?? it.measure ?? '';
          amount = `${quantity}${unit ? ' ' + unit : ''}`.trim();
        } else if (it.grams) {
          amount = `${it.grams} g`;
        } else if (it.ml) {
          amount = `${it.ml} ml`;
        } else if (it.oz) {
          amount = `${it.oz} oz`;
        }
        return { name, amount: amount.toString() };
      }
      return { name: String(it), amount: '' };
    });
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
      setEditableItems(normalizeItems(parsedResult?.items || []));
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
      setEditableItems(normalizeItems(parsedResult?.items || []));
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

  // Update item for name or amount
  const updateItem = (index: number, field: 'name' | 'amount', value: string) => {
    const updated = [...editableItems];
    updated[index] = { ...updated[index], [field]: value };
    setEditableItems(updated);
  };

  const addItem = () => {
    const newItem = { name: '', amount: '' };
    setEditableItems(items => {
      const newArr = [...items, newItem];
      setEditingIndex(newArr.length - 1);
      return newArr;
    });
  };

  const removeItem = (index:number) => {
    const updated = editableItems.filter((_, i) => i !== index);
    setEditableItems(updated);
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
      // Build a local meal object for local-first saving
      const localMeal = {
        id: Date.now().toString(),
        name: analysisResult?.mealName || '', // Save meal name from analysis result if available
        context: mealContext,
        items: editableItems,
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
                items: localMeal.items,
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

  // Track which item is in edit mode
  const [editingIndex, setEditingIndex] = useState<number | null>(null);


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex:1, backgroundColor: colors.background }}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding:16, paddingBottom:200 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
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
              <Text style={{ fontSize:16, fontWeight:'600', marginBottom:12, color: colors.text }}>Detected Items</Text>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                {mealTitleEditing ? (
                  <TextInput
                    value={mealTitle}
                    onChangeText={setMealTitle}
                    style={{
                      flex:1,
                      fontSize:15,
                      fontWeight:'600',
                      color: colors.text,
                      backgroundColor: colors.card,
                      borderRadius:6,
                      padding:6,
                      marginRight:8,
                    }}
                    autoFocus
                    ref={input => {
                      if (input) {
                        input.focus();
                        setTimeout(() => {
                          scrollRef.current?.scrollTo({ y: 0, animated: true });
                        }, 100);
                      }
                    }}
                  />
                ) : (
                  <Text style={{ fontSize:15, fontWeight:'600', color: colors.primary, flex:1 }}>
                    Meal: {mealTitle}
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
              {editableItems.map((item, i) => (
                <View
                  key={i + '-' + (editingIndex === i ? 'edit' : 'view')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    borderBottomWidth: i < editableItems.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                    paddingHorizontal: 4,
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    {editingIndex === i ? (
                      <>
                        <TextInput
                          value={item.name}
                          onChangeText={text => updateItem(i, 'name', text)}
                          style={{
                            fontSize: 15,
                            fontWeight: '600',
                            color: colors.text,
                            marginBottom: 4,
                            backgroundColor: colors.card,
                            borderRadius: 6,
                            padding: 6,
                          }}
                          placeholder="Name"
                          autoFocus
                          ref={input => {
                            if (input) {
                              input.focus();
                              setTimeout(() => {
                                scrollRef.current?.scrollToEnd({ animated: true });
                              }, 100);
                            }
                          }}
                        />
                        <TextInput
                          value={item.amount}
                          onChangeText={text => updateItem(i, 'amount', text)}
                          style={{
                            fontSize: 13,
                            color: colors.text,
                            opacity: 0.7,
                            marginBottom: 6,
                            backgroundColor: colors.card,
                            borderRadius: 6,
                            padding: 6,
                          }}
                          placeholder="Amount"
                          ref={input => {
                            if (input) {
                              input.focus();
                              setTimeout(() => {
                                scrollRef.current?.scrollToEnd({ animated: true });
                              }, 100);
                            }
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary, marginBottom: 4 }}>
                          {item.name}
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.text, opacity: 0.7, marginBottom: 6 }}>
                          {item.amount}
                        </Text>
                      </>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => {
                        removeItem(i);
                        setEditingIndex(editIdx =>
                          editIdx === i ? null : editIdx !== null && editIdx > i ? editIdx - 1 : editIdx
                        );
                      }}
                      style={{
                        padding: 6,
                        borderRadius: 6,
                        backgroundColor: 'transparent',
                        marginRight: 2,
                      }}
                      accessibilityLabel="Delete"
                    >
                      <Ionicons name="trash-outline" size={22} color="#d11a2a" />
                    </TouchableOpacity>
                    {editingIndex === i ? (
                      <TouchableOpacity
                        onPress={() => setEditingIndex(null)}
                        style={{
                          padding: 6,
                          borderRadius: 6,
                          backgroundColor: 'transparent',
                        }}
                        accessibilityLabel="Confirm"
                      >
                        <Ionicons name="checkmark" size={22} color={colors.success || "#2ecc40"} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setEditingIndex(i)}
                        style={{
                          padding: 6,
                          borderRadius: 6,
                          backgroundColor: 'transparent',
                        }}
                        accessibilityLabel="Edit"
                      >
                        <Ionicons name="pencil" size={20} color={colors.text} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              <TouchableOpacity onPress={addItem} style={{ marginTop:12 }}>
                <Text style={{ color: colors.primary, fontWeight:'600' }}>+ Add Ingredient</Text>
              </TouchableOpacity>
            </Card>

            {/* Nutrition/macros card intentionally removed per requirements */}



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


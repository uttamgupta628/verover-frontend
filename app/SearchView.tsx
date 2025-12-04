import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Keyboard,
  ScrollView,
} from 'react-native';
import colors from '../assets/color';

// EXPO-SPECIFIC IMPORTS
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SearchViewProps {
  onClose: () => void;
  onBack: () => void;
}

interface KeywordProps {
  text: string;
  onRemove: () => void;
  onPress: () => void;
}

const Keyword: React.FC<KeywordProps> = ({ text, onRemove, onPress }) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleRemove = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onRemove();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });
  };

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        style={styles.keywordContainer}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Feather name="clock" size={16} color={colors.gray} style={styles.keywordIcon} />
        <Text style={styles.keywordText} numberOfLines={1}>{text}</Text>
        <TouchableOpacity
          onPress={handleRemove}
          style={styles.removeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={16} color={colors.gray} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const SearchView: React.FC<SearchViewProps> = ({ onClose, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  // Load recent searches on mount
  useEffect(() => {
    loadRecentSearches();
    // Focus input on mount
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  // Search effect
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const loadRecentSearches = async () => {
    try {
      const storedSearches = await AsyncStorage.getItem('recent_searches');
      if (storedSearches) {
        setRecentSearches(JSON.parse(storedSearches));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveRecentSearch = async (query: string) => {
    try {
      const updatedSearches = [query, ...recentSearches.filter(s => s !== query)].slice(0, 10);
      setRecentSearches(updatedSearches);
      await AsyncStorage.setItem('recent_searches', JSON.stringify(updatedSearches));
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

  const performSearch = (query: string) => {
    setIsSearching(true);
    // Simulate search results - in real app, this would be an API call
    const mockResults = [
      `Parking near ${query}`,
      `Garage at ${query}`,
      `Street parking ${query}`,
      `Reserved spot ${query}`,
    ];
    setSearchResults(mockResults);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery.trim());
      Keyboard.dismiss();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // In real app, navigate to search results
      console.log('Search for:', searchQuery);
    }
  };

  const handleKeywordPress = (keyword: string) => {
    setSearchQuery(keyword);
    Haptics.selectionAsync();
  };

  const handleKeywordRemove = async (keyword: string) => {
    const updatedSearches = recentSearches.filter(s => s !== keyword);
    setRecentSearches(updatedSearches);
    try {
      await AsyncStorage.setItem('recent_searches', JSON.stringify(updatedSearches));
    } catch (error) {
      console.error('Error removing recent search:', error);
    }
  };

  const handleClearAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Clear All',
      'Are you sure you want to clear all recent searches?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setRecentSearches([]);
            try {
              await AsyncStorage.removeItem('recent_searches');
            } catch (error) {
              console.error('Error clearing searches:', error);
            }
          },
        },
      ],
    );
  };

  const handleBackWithHaptic = () => {
    Haptics.selectionAsync();
    onBack();
  };

  const handleCloseWithHaptic = () => {
    Haptics.selectionAsync();
    onClose();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search Header */}
      <BlurView intensity={80} tint="light" style={styles.searchHeader}>
        <View style={styles.searchInputContainer}>
          <TouchableOpacity 
            onPress={handleBackWithHaptic}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color={colors.primary} />
          </TouchableOpacity>
          
          <View style={styles.inputWrapper}>
            <Feather name="search" size={20} color={colors.gray} style={styles.searchIcon} />
            <TextInput
              ref={inputRef}
              placeholder="Search for parking, locations..."
              placeholderTextColor={colors.gray}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                onPress={() => {
                  setSearchQuery('');
                  Haptics.selectionAsync();
                }}
                style={styles.clearButton}
              >
                <Feather name="x-circle" size={20} color={colors.gray} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            onPress={handleCloseWithHaptic}
            style={styles.closeButton}
          >
            <Feather name="x" size={24} color={colors.gray} />
          </TouchableOpacity>
        </View>
      </BlurView>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isSearching ? (
          // Search Results
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Search Results</Text>
            {searchResults.map((result, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.resultItem}
                onPress={() => handleKeywordPress(result)}
              >
                <Feather name="map-pin" size={18} color={colors.primary} style={styles.resultIcon} />
                <Text style={styles.resultText}>{result}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          // Recent Searches
          <>
            {recentSearches.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recent Searches</Text>
                  <TouchableOpacity onPress={handleClearAll}>
                    <Text style={styles.clearAllText}>Clear All</Text>
                  </TouchableOpacity>
                </View>
                {recentSearches.map((search, index) => (
                  <Keyword
                    key={index}
                    text={search}
                    onRemove={() => handleKeywordRemove(search)}
                    onPress={() => handleKeywordPress(search)}
                  />
                ))}
              </View>
            )}

            {/* Popular Searches */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Popular Searches</Text>
              <View style={styles.popularContainer}>
                {['Downtown', 'Airport', 'Mall', 'Hospital', 'University'].map((tag, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.tag}
                    onPress={() => handleKeywordPress(tag)}
                  >
                    <Feather name="trending-up" size={14} color={colors.primary} />
                    <Text style={styles.tagText}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Search Tips */}
        {!isSearching && (
          <View style={styles.tipsSection}>
            <Feather name="lightbulb" size={20} color={colors.warning} style={styles.tipsIcon} />
            <Text style={styles.tipsTitle}>Search Tips</Text>
            <Text style={styles.tipsText}>
              • Try searching by location name or address{'\n'}
              • Use specific landmarks for better results{'\n'}
              • Filter by price or availability in settings
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  searchHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.black,
    height: '100%',
  },
  clearButton: {
    padding: 4,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.black,
  },
  clearAllText: {
    fontSize: 14,
    color: colors.gray,
  },
  keywordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  keywordIcon: {
    marginRight: 12,
  },
  keywordText: {
    flex: 1,
    fontSize: 16,
    color: colors.black,
  },
  removeButton: {
    padding: 4,
  },
  popularContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightPrimary + '20',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    marginLeft: 6,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  resultIcon: {
    marginRight: 12,
  },
  resultText: {
    fontSize: 16,
    color: colors.black,
  },
  tipsSection: {
    marginTop: 32,
    marginBottom: 40,
    padding: 20,
    backgroundColor: colors.lightPrimary + '10',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  tipsIcon: {
    marginBottom: 8,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 14,
    color: colors.gray,
    lineHeight: 20,
  },
});

export default SearchView;
import { createContext, useContext } from 'react';

export type Language = 'en' | 'ja';

export interface Translations {
  // Common
  loading: string;
  error: string;
  close: string;
  save: string;
  cancel: string;
  delete: string;
  reset: string;
  settings: string;
  sources: string;
  complete: string;
  
  // Header
  videoLM: string;
  tagline: string;
  
  // Video Upload
  uploadTitle: string;
  uploadDescription: string;
  dropZoneText: string;
  browseFiles: string;
  supportedFormats: string;
  maxFileSize: string;
  uploading: string;
  uploadFailed: string;
  format: string;
  
  // Video List
  selectVideo: string;
  noVideos: string;
  uploadFirst: string;
  duration: string;
  fileSize: string;
  uploadedAt: string;
  videos: string;
  selected: string;
  
  // Video Player
  noVideoSelected: string;
  selectToPlay: string;
  
  // Chat Interface
  chatInterface: string;
  askAboutSelectedVideo: string;
  noVideoSelectedChat: string;
  selectVideoToChat: string;
  aiAnalysisReady: string;
  aiReadyDescription: string;
  askAnything: string;
  readyToAnalyze: string;
  askAboutVideo: string;
  selectVideoFirst: string;
  clearHistory: string;
  
  // Q&A Interface
  qaInterface: string;
  chatHistoryPanel: string;
  rephrasedQuestion: string;
  botResponse: string;
  relatedFrames: string;
  askVideoQuestion: string;
  
  // Summary Panel
  videoSummary: string;
  generateSummary: string;
  generating: string;
  keyPoints: string;
  transcription: string;
  chatHistoryTab: string;
  videoDetails: string;
  analysisResults: string;
  
  // Settings
  settingsTitle: string;
  settingsDescription: string;
  dataManagement: string;
  resetAllData: string;
  resetWarning: string;
  confirmReset: string;
  confirmTitle: string;
  resetComplete: string;
  resetSuccess: string;
  resetFailed: string;
  language: string;
  languageDescription: string;
  english: string;
  japanese: string;
  
  // Processing
  processing: string;
  analyzing: string;
  extractingFrames: string;
  uploadComplete: string;
  browserNotSupported: string;
}

const translations: Record<Language, Translations> = {
  en: {
    // Common
    loading: 'Loading...',
    error: 'Error',
    close: 'Close',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    reset: 'Reset',
    settings: 'Settings',
    sources: 'Sources',
    complete: 'Complete',
    
    // Header
    videoLM: 'VideoLM',
    tagline: 'AI-Powered Video Understanding',
    
    // Video Upload
    uploadTitle: 'Upload Videos',
    uploadDescription: 'Add videos to analyze with AI',
    dropZoneText: 'Drop video files here or click to browse',
    browseFiles: 'Browse Files',
    supportedFormats: 'Supported formats: MP4, AVI, MOV, WMV',
    maxFileSize: 'Maximum file size: 100MB',
    uploading: 'Uploading...',
    uploadFailed: 'Upload failed',
    format: 'Format',
    
    // Video List
    selectVideo: 'Select video to analyze',
    noVideos: 'No videos uploaded',
    uploadFirst: 'Upload your first video to get started',
    duration: 'Duration',
    fileSize: 'File size',
    uploadedAt: 'Uploaded',
    videos: 'Videos',
    selected: 'selected',
    
    // Video Player
    noVideoSelected: 'No video selected',
    selectToPlay: 'Select a video from the left panel to play',
    
    // Chat Interface
    chatInterface: 'Chat Interface',
    askAboutSelectedVideo: 'Ask about your selected video',
    noVideoSelectedChat: 'No video selected',
    selectVideoToChat: 'Select a video to start chatting about its content',
    aiAnalysisReady: 'AI Analysis Ready',
    aiReadyDescription: "I've analyzed your video and I'm ready to answer questions about its content, visual elements, and any other aspects you'd like to explore. What would you like to know?",
    askAnything: 'Ask anything about the video...',
    readyToAnalyze: 'Ready to analyze',
    askAboutVideo: 'Ask me anything about this video',
    selectVideoFirst: 'Select a video first',
    clearHistory: 'Clear History',
    
    // Q&A Interface
    qaInterface: 'Q&A',
    chatHistoryPanel: 'Chat History',
    rephrasedQuestion: 'Question',
    botResponse: 'Response',
    relatedFrames: 'Related Frames',
    askVideoQuestion: 'Ask about this video...',
    
    // Summary Panel
    videoSummary: 'Video Summary',
    generateSummary: 'Generate Summary',
    generating: 'Generating...',
    keyPoints: 'Key Points',
    transcription: 'Transcription',
    chatHistoryTab: 'Chat History',
    videoDetails: 'Video Details',
    analysisResults: 'Analysis Results',
    
    // Settings
    settingsTitle: 'Settings',
    settingsDescription: 'Manage your VideoLM preferences and data.',
    dataManagement: 'Data Management',
    resetAllData: 'Reset All Data',
    resetWarning: 'This will permanently delete all uploaded videos, chat messages, and session data.',
    confirmReset: 'Yes, reset everything',
    confirmTitle: 'Are you absolutely sure?',
    resetComplete: 'Reset Complete',
    resetSuccess: 'All videos and data have been cleared successfully.',
    resetFailed: 'Failed to reset data',
    language: 'Language',
    languageDescription: 'Choose your preferred language',
    english: 'English',
    japanese: '日本語',
    
    // Processing
    processing: 'Processing...',
    analyzing: 'Analyzing video...',
    extractingFrames: 'Extracting frames...',
    uploadComplete: 'Upload complete',
    analysisComplete: 'Analysis complete',
    browserNotSupported: 'Your browser does not support the video tag.',
  },
  
  ja: {
    // Common
    loading: '読み込み中...',
    error: 'エラー',
    close: '閉じる',
    save: '保存',
    cancel: 'キャンセル',
    delete: '削除',
    reset: 'リセット',
    settings: '設定',
    sources: 'ソース',
    complete: '完了',
    
    // Header
    videoLM: 'VideoLM',
    tagline: 'AI搭載動画理解システム',
    
    // Video Upload
    uploadTitle: 'アップロード',
    uploadDescription: 'AIで分析する動画を追加',
    dropZoneText: '動画ファイルをここにドロップするか、クリックして選択',
    browseFiles: 'ファイルを選択',
    supportedFormats: '対応形式: MP4, AVI, MOV, WMV',
    maxFileSize: '最大ファイルサイズ: 100MB',
    uploading: 'アップロード中...',
    uploadFailed: 'アップロードに失敗しました',
    format: 'フォーマット',
    
    // Video List
    selectVideo: '分析する動画を選択',
    noVideos: 'アップロードされた動画はありません',
    uploadFirst: '最初の動画をアップロードして開始',
    duration: '再生時間',
    fileSize: 'ファイルサイズ',
    uploadedAt: 'アップロード日時',
    videos: '動画',
    selected: '選択済み',
    
    // Video Player
    noVideoSelected: '動画が選択されていません',
    selectToPlay: '左パネルから動画を選択して再生',
    
    // Chat Interface
    chatInterface: 'チャットインターフェース',
    askAboutSelectedVideo: '選択した動画について質問',
    noVideoSelectedChat: '動画が選択されていません',
    selectVideoToChat: '動画を選択してコンテンツについて会話を開始',
    aiAnalysisReady: 'AI分析準備完了',
    aiReadyDescription: '動画を分析し、コンテンツ、視覚的要素、その他の側面について質問にお答えする準備ができています。何をお聞きになりたいですか？',
    askAnything: '動画について何でもお聞きください...',
    readyToAnalyze: '分析準備完了',
    askAboutVideo: 'この動画について何でもお聞きください',
    selectVideoFirst: '最初に動画を選択してください',
    clearHistory: '履歴をクリア',
    
    // Q&A Interface
    qaInterface: 'Q&A',
    chatHistoryPanel: 'チャット履歴',
    rephrasedQuestion: '質問',
    botResponse: '回答',
    relatedFrames: '関連フレーム',
    askVideoQuestion: 'この動画について何でもお聞きください...',
    
    // Summary Panel
    videoSummary: '動画概要',
    generateSummary: '要約を生成',
    generating: '生成中...',
    keyPoints: 'キーポイント',
    transcription: '文字起こし',
    chatHistoryTab: 'チャット履歴',
    videoDetails: '動画詳細',
    analysisResults: '分析結果',
    
    // Settings
    settingsTitle: '設定',
    settingsDescription: 'VideoLMの設定とデータを管理します。',
    dataManagement: 'データ管理',
    resetAllData: 'すべてのデータをリセット',
    resetWarning: 'アップロードされた動画、チャットメッセージ、セッションデータが完全に削除されます。',
    confirmReset: 'はい、すべてリセットします',
    confirmTitle: '本当によろしいですか？',
    resetComplete: 'リセット完了',
    resetSuccess: 'すべての動画とデータが正常にクリアされました。',
    resetFailed: 'データのリセットに失敗しました',
    language: '言語',
    languageDescription: '優先言語を選択してください',
    english: 'English',
    japanese: '日本語',
    
    // Processing
    processing: '処理中...',
    analyzing: '動画を分析中...',
    extractingFrames: 'フレームを抽出中...',
    uploadComplete: 'アップロード完了',
    analysisComplete: '分析完了',
    browserNotSupported: 'お使いのブラウザはビデオタグをサポートしていません。',
  },
};

export interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

export const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

export const getTranslations = (language: Language): Translations => {
  return translations[language];
};
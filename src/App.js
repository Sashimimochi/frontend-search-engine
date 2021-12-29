import './App.css';
import FuseSearchEngine from './components/fuse-search-engine';


function App() {
  return (
    <div className="App">
      <FuseSearchEngine searchType="and" />
      <FuseSearchEngine searchType="or" />
      <FuseSearchEngine searchType="plain" />
      <FuseSearchEngine searchType="or" tokenizer="trigram" />
    </div>
  );
}

export default App;

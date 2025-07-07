import './App.css';
import { Route, Routes } from 'react-router-dom';
import Header from './components/header';

function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path='/' element={<p>Home</p>} />
        <Route path='*' element={<p>404</p>} />
      </Routes>
    </>
  );
}

export default App;

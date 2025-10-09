import { Route, Routes } from "react-router-dom";
import { ROUTE } from "./lib/constants";

import Home from "./pages/home";
import NotFound from "./pages/NotFound";
import QRPhotoUpload from "./pages/qr-photo";

const App = () => {
  return (
    <Routes>
      <Route path={ROUTE.HOME} element={<Home />} />
      <Route path={ROUTE.QR_PHOTO} element={<QRPhotoUpload />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default App;

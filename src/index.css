@import "tailwindcss";

@theme {
  --color-paradise-pink: #D697A7;
  --color-paradise-blue: #70D1CD;
  --color-paradise-sunset: #D96A46;
  --color-paradise-mint: #56C49D;
  --color-paradise-lavender: #9F83C1;
  --color-paradise-ocean: #007A99;

  --animate-floating: floating 6s ease-in-out infinite;
  --animate-fade-in: fadeIn 0.8s ease-out forwards;

  @keyframes floating {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
  }
  @keyframes fadeIn {
    0% { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
}

:root {
  font-family: 'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
  background: linear-gradient(-45deg, #FFDEE9, #B5FFFC, #E2D1F9, #B5FFFC);
  background-size: 400% 400%;
  animation: gradientBG 15s ease infinite;
  color: #2D2D2D;
  overflow-x: hidden;
}

@keyframes gradientBG {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@utility glass {
  background-color: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
}

@utility glass-dark {
  background-color: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

@utility no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

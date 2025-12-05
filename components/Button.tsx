import React from 'react';

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ onClick, children, variant = 'primary', disabled = false, className = '' }) => {
  const baseStyle = "w-full py-3 px-4 rounded-lg font-bold transition-all duration-200 transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg";
  
  let variantStyle = "";
  switch (variant) {
    case 'primary':
      variantStyle = "bg-blue-600 hover:bg-blue-500 text-white border-b-4 border-blue-800";
      break;
    case 'secondary':
      variantStyle = "bg-gray-700 hover:bg-gray-600 text-white border-b-4 border-gray-900";
      break;
    case 'danger':
      variantStyle = "bg-red-600 hover:bg-red-500 text-white border-b-4 border-red-800";
      break;
  }

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variantStyle} ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;
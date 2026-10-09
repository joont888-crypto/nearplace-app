// Tailwind CSS Custom Configuration - Soft Neumorphic Luxury Palette
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                neu: {
                    bg: '#E5E3E0',
                    surface: '#E9E7E4',
                    recessed: '#DCDAD7',
                    highlight: '#F2F0ED',
                    primary: '#222222',
                    secondary: '#777777',
                    muted: '#999999',
                    accent: '#B89A67'
                },
                'neu-dark': {
                    bg: '#242321',
                    surface: '#2C2A28',
                    recessed: '#1F1E1C',
                    highlight: '#343230',
                    primary: '#F1EFEC',
                    secondary: '#AAA6A0',
                    muted: '#77736D',
                    accent: '#C5A059'
                }
            },
            fontFamily: {
                sans: ['Inter', 'Prompt', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
                serif: ['Cormorant Garamond', 'serif'],
            },
            borderRadius: {
                'sm-ctrl': '18px',
                'btn': '24px',
                'card': '32px',
                'container': '40px',
                'capsule': '9999px'
            }
        }
    }
};

import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface PricingCardProps {
  plan: {
    name: string;
    price: string;
    description?: string;
    features: string[];
    isRecommended?: boolean;
    buttonText?: string;
    onButtonClick?: () => void;
  };
}

const PricingCard: React.FC<PricingCardProps> = ({ plan }) => {
  const {
    name,
    price,
    description,
    features,
    isRecommended = false,
    buttonText = '選択する',
    onButtonClick,
  } = plan;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        border: isRecommended ? '2px solid #34d399' : '1px solid #e2e8f0',
        boxShadow: isRecommended
          ? '0 20px 25px -5px rgba(52, 211, 153, 0.1), 0 10px 10px -5px rgba(52, 211, 153, 0.04)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        },
      }}
    >
      {isRecommended && (
        <Chip
          label="おすすめ"
          color="primary"
          sx={{
            position: 'absolute',
            top: -12,
            right: 24,
            backgroundColor: '#34d399',
            color: 'white',
            fontWeight: 'bold',
          }}
        />
      )}

      <CardContent sx={{ flex: 1, pt: isRecommended ? 4 : 3 }}>
        <Typography
          variant="h5"
          component="h3"
          sx={{
            fontWeight: 'bold',
            color: '#1e293b',
            mb: 1,
          }}
        >
          {name}
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h3"
            component="div"
            sx={{
              fontWeight: 'bold',
              color: isRecommended ? '#34d399' : '#334155',
              mb: 1,
            }}
          >
            {price}
            {price !== 'お問い合わせ' && (
              <Typography
                component="span"
                variant="body2"
                sx={{ ml: 1, color: '#64748b' }}
              >
                /月
              </Typography>
            )}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>

        <List sx={{ py: 0 }}>
          {features.map((feature, index) => (
            <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <CheckCircleIcon
                  sx={{
                    color: '#34d399',
                    fontSize: 20,
                  }}
                />
              </ListItemIcon>
              <ListItemText
                primary={feature}
                primaryTypographyProps={{
                  variant: 'body2',
                  color: '#475569',
                }}
              />
            </ListItem>
          ))}
        </List>
      </CardContent>

      <CardActions sx={{ px: 3, pb: 3 }}>
        <Button
          fullWidth
          variant={isRecommended ? 'contained' : 'outlined'}
          size="large"
          onClick={onButtonClick}
          sx={{
            backgroundColor: isRecommended ? '#34d399' : 'transparent',
            borderColor: '#34d399',
            color: isRecommended ? 'white' : '#34d399',
            textTransform: 'none',
            fontWeight: 'bold',
            py: 1.5,
            '&:hover': {
              backgroundColor: isRecommended ? '#22c55e' : 'rgba(52, 211, 153, 0.04)',
              borderColor: '#34d399',
            },
          }}
        >
          {buttonText}
        </Button>
      </CardActions>
    </Card>
  );
};

export default PricingCard;
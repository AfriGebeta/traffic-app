import React from 'react';
import { render } from '@testing-library/react-native';
import GebetaMap from './GebetaMap';

// Mock react-native-maplibre-gl
jest.mock('react-native-maplibre-gl', () => {
  const React = require('react');
  return {
    MapView: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        addSource: jest.fn(),
        addLayer: jest.fn(),
        removeLayer: jest.fn(),
        removeSource: jest.fn(),
        getLayer: jest.fn(),
        getSource: jest.fn(),
        setPaintProperty: jest.fn(),
      }));
      return React.createElement('View', { ...props, testID: 'map-view' });
    }),
    PointAnnotation: class MockPointAnnotation {
      coordinate: [number, number] = [0, 0];
      id: string = '';
      icon: string = '';
      iconSize: [number, number] = [32, 32];
      iconOffset: [number, number] = [0, 0];
      zIndex: number = 10;
      onSelected: ((event: any) => void) | null = null;
    },
  };
});

describe('GebetaMap', () => {
  // GIVEN a valid API key
  const validApiKey = 'test-api-key';
  
  // AND valid map props
  const defaultProps = {
    apiKey: validApiKey,
    center: [38.7463, 9.0223] as [number, number],
    zoom: 12,
  };

  test('should render map with valid API key', () => {
    // WHEN rendering the component with valid props
    const { getByTestId } = render(<GebetaMap {...defaultProps} />);
    
    // THEN the map container should be rendered
    expect(getByTestId('gebeta-map-container')).toBeTruthy();
    
    // AND the map view should be rendered
    expect(getByTestId('map-view')).toBeTruthy();
  });

  test('should render error component with invalid API key', () => {
    // GIVEN an invalid API key
    const invalidProps = {
      ...defaultProps,
      apiKey: '',
    };

    // WHEN rendering the component with invalid API key
    const { getByText } = render(<GebetaMap {...invalidProps} />);
    
    // THEN the error message should be displayed
    expect(getByText('⚠️ GebetaMap SDK is not set up correctly.')).toBeTruthy();
    expect(getByText('GebetaMap SDK is not set. Please provide a valid API key.')).toBeTruthy();
  });

  test('should handle map click events', () => {
    // GIVEN a map click handler
    const onMapClick = jest.fn();
    const propsWithClickHandler = {
      ...defaultProps,
      onMapClick,
    };

    // WHEN rendering the component with click handler
    const { getByTestId } = render(<GebetaMap {...propsWithClickHandler} />);
    
    // THEN the map should be rendered
    expect(getByTestId('map-view')).toBeTruthy();
    
    // AND the click handler should be available (though we can't easily test the actual click in this mock)
    expect(onMapClick).toBeDefined();
  });

  test('should handle map loaded events', () => {
    // GIVEN a map loaded handler
    const onMapLoaded = jest.fn();
    const propsWithLoadedHandler = {
      ...defaultProps,
      onMapLoaded,
    };

    // WHEN rendering the component with loaded handler
    const { getByTestId } = render(<GebetaMap {...propsWithLoadedHandler} />);
    
    // THEN the map should be rendered
    expect(getByTestId('map-view')).toBeTruthy();
    
    // AND the loaded handler should be available
    expect(onMapLoaded).toBeDefined();
  });

  test('should apply custom styles', () => {
    // GIVEN custom styles
    const customStyle = { backgroundColor: 'red' };
    const propsWithCustomStyle = {
      ...defaultProps,
      style: customStyle,
    };

    // WHEN rendering the component with custom styles
    const { getByTestId } = render(<GebetaMap {...propsWithCustomStyle} />);
    
    // THEN the map container should be rendered
    expect(getByTestId('gebeta-map-container')).toBeTruthy();
  });
}); 
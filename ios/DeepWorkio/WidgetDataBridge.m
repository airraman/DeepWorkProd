//
//  WidgetDataBridge.m
//  DeepWorkio
//
//  RN bridge export for WidgetDataBridge.swift. See that file for behavior.

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetDataBridge, NSObject)

RCT_EXTERN_METHOD(setSharedState:(NSString *)jsonString
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getPendingSessionStart:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearPendingSessionStart:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(createPendingSessionStart:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

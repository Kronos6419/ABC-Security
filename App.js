import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './services/firebase';

import { initDB } from './services/db';
import { startSyncLoop } from './services/sync';

// Screens
import AdminReviewScreen from './screens/AdminReviewScreen';
import CameraScreen from './screens/CameraScreen';
import HomeScreen from './screens/HomeScreen';
import IncidentReportScreen from './screens/IncidentReportScreen';
import LocationScreen from './screens/LocationScreen';
import LoginScreen from './screens/LoginScreen';
import LostFoundReportScreen from './screens/LostFoundReportScreen';
import MaintenanceReportScreen from './screens/MaintenanceReportScreen';
import ReportDetailScreen from './screens/ReportDetailScreen';
import ReportsScreen from './screens/ReportsScreen';

const HEADER = {
  headerStyle: { backgroundColor: '#3EA0D1' },
  headerTintColor: '#fff',
  headerTitleAlign: 'center',
};

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();
const Tabs = createBottomTabNavigator();

/** Admin config */
const ADMIN_EMAILS = ['admin@example.com'];
const ADMIN_DOMAINS = ['abcsecurity.co.nz'];

/* Tabs */

function UserTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let icon = 'home';
          if (route.name === 'Home') icon = 'home';
          if (route.name === 'Camera') icon = 'camera';
          if (route.name === 'Reports') icon = 'document-text';
          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tabs.Screen name="Camera" component={CameraScreen} />
      <Tabs.Screen name="Reports" component={ReportsScreen} />
    </Tabs.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let icon = 'home';
          if (route.name === 'AdminReview') icon = 'home';
          if (route.name === 'Camera') icon = 'camera';
          if (route.name === 'Reports') icon = 'document-text';
          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen
        name="AdminReview"
        component={AdminReviewScreen}
        options={{ title: 'Admin Review' }}
      />
      <Tabs.Screen name="Camera" component={CameraScreen} />
      <Tabs.Screen name="Reports" component={ReportsScreen} />
    </Tabs.Navigator>
  );
}

/* Admin detection */

function useAdmin(user) {
  const [isAdmin, setIsAdmin] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user) { if (!cancelled) setIsAdmin(false); return; }

      const email = (user.email || '').toLowerCase();
      const base =
        ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email) ||
        ADMIN_DOMAINS.some((d) => email.endsWith(`@${d.toLowerCase()}`));

      let finalFlag = base;

      try {
        const snap = await getDoc(doc(db, 'admins', user.uid));
        if (snap.exists() && snap.data()?.active === true) {
          finalFlag = true;
        }
      } catch {
        // ignore
      }

      if (!cancelled) setIsAdmin(finalFlag);
    }
    check();
    return () => { cancelled = true; };
  }, [user]);

  return isAdmin;
}

/* Drawer content */

function DrawerContent(props) {
  const insets = useSafeAreaInsets();
  const email = auth.currentUser?.email || 'unknown';
  const isAdmin = props.isAdmin;

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{ flexGrow: 1, paddingTop: 0 }}
    >
      <View style={[styles.headerBlock, { paddingTop: insets.top + 8 }]}>
        <Image
          source={require('./assets/images/logo.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.appName}>ABC Security Hub</Text>
          <Text style={styles.signedInAs} numberOfLines={1}>{email}</Text>
          {isAdmin ? <Text style={styles.adminBadge}>Admin</Text> : null}
        </View>
      </View>

      <View style={{ height: 10 }} />

      <DrawerItemList {...props} />

      <View style={{ flex: 1 }} />

      <View style={[styles.signoutWrap, { paddingBottom: insets.bottom + 18 }]}>
        <TouchableOpacity onPress={() => signOut(auth)} style={styles.signoutBtn}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.signoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

/* Drawer with dynamic tabs */

function MainDrawer({ user }) {
  const isAdmin = useAdmin(user);

  return (
    <Drawer.Navigator
      screenOptions={HEADER}
      drawerContent={(props) => <DrawerContent {...props} isAdmin={isAdmin} />}
    >
      <Drawer.Screen
        key={isAdmin ? 'dashboard-admin' : 'dashboard-user'}
        name="Dashboard"
        options={{ title: 'Dashboard' }}
      >
        {() => (isAdmin ? <AdminTabs /> : <UserTabs />)}
      </Drawer.Screen>

      <Drawer.Screen
        name="Location"
        component={LocationScreen}
        options={{ title: 'Location' }}
      />
    </Drawer.Navigator>
  );
}

/* App root */

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await initDB();
      startSyncLoop();
    })().catch((e) => console.warn('startup:', e?.message || e));
  }, []);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setReady(true);
    });
    return off;
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="MainApp">
              {(props) => <MainDrawer {...props} user={user} />}
            </Stack.Screen>

            {/* Push screens */}
            <Stack.Screen
              name="IncidentReport"
              component={IncidentReportScreen}
              options={{ ...HEADER, headerShown: true, title: 'Incident / Damage Report' }}
            />
            <Stack.Screen
              name="ReportDetail"
              component={ReportDetailScreen}
              options={{ ...HEADER, headerShown: true, title: 'Report Detail' }}
            />
            <Stack.Screen
              name="LostFoundReport"
              component={LostFoundReportScreen}
              options={{ ...HEADER, headerShown: true, title: 'Lost / Found Property Report' }}
            />

            <Stack.Screen
              name="MaintenanceReport"
              component={MaintenanceReportScreen}
              options={{ ...HEADER, headerShown: true, title: 'Maintenance / Equipment Fault' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/* styles */
const styles = StyleSheet.create({
  headerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF6FC',
    borderBottomWidth: 1,
    borderBottomColor: '#D7E7F3',
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  headerLogo: { width: 36, height: 36, marginRight: 10 },
  appName: { fontWeight: '800', color: '#1e1e1e' },
  signedInAs: { color: '#4b4b4b', fontSize: 12, marginTop: 2 },
  adminBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#3EA0D1',
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  signoutWrap: { paddingHorizontal: 14, paddingTop: 8 },
  signoutBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#c94c4c',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  signoutText: { color: '#fff', fontWeight: '700' },
});
